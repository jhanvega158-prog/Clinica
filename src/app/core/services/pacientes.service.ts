import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BaseRepository } from '../repositories/base.repository';
import { supabase, supabaseDynamic } from '../config/supabase';
import {
  DocumentoClinico,
  DocumentoClinicoInsert,
  HistoriaClinica,
  Paciente,
  PacienteInsert,
  PacienteUpdate,
  Seguro
} from '../models/interfaces/database.types';
import { buildStoragePath } from '../../shared/utils/file-path';
import {
  isValidEcuadorianCedula,
  normalizeEmail,
  normalizeName,
  normalizeWhitespace,
  TEXT_PATTERN
} from '../../shared/utils/validation.utils';

@Injectable({ providedIn: 'root' })
export class PacientesService extends BaseRepository<Paciente, PacienteInsert, PacienteUpdate> {
  constructor() {
    super('pacientes', 'apellidos');
  }

  override async create(payload: PacienteInsert): Promise<Paciente> {
    return super.create(this.validatePayload(payload) as PacienteInsert);
  }

  override async update(id: string, payload: PacienteUpdate): Promise<Paciente> {
    return super.update(id, this.validatePayload(payload) as PacienteUpdate);
  }

  async search(term: string): Promise<Paciente[]> {
    const value = `%${term}%`;
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .or(`nombres.ilike.${value},apellidos.ilike.${value},cedula.ilike.${value},telefono.ilike.${value}`)
      .order('apellidos', { ascending: true });

    this.throwIfError(error);
    return data ?? [];
  }

  async findByCedula(cedula: string): Promise<Paciente | null> {
    const value = cedula.trim();
    if (!value) {
      return null;
    }

    const { data, error } = await supabaseDynamic
      .from('pacientes')
      .select('*')
      .eq('cedula', value)
      .maybeSingle();

    this.throwIfError(error);
    return (data as Paciente | null) ?? null;
  }

  async buscarPorCedulaConDetalles(cedula: string): Promise<{
    paciente: Paciente | null;
    historia: HistoriaClinica | null;
    seguro: string | null;
    edad: number | null;
  }> {
    const paciente = await this.findByCedula(cedula);
    if (!paciente) {
      return { paciente: null, historia: null, seguro: null, edad: null };
    }

    const [{ data: historiaData, error: historiaError }, { data: segurosData, error: segurosError }] = await Promise.all([
      supabaseDynamic
        .from('historias_clinicas')
        .select('*')
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseDynamic
        .from('paciente_seguros')
        .select('seguro_id, seguros (nombre)')
        .eq('paciente_id', paciente.id)
        .eq('activo', true)
    ]);

    this.throwIfError(historiaError);
    this.throwIfError(segurosError);

    const seguro = (segurosData ?? [])
      .map((item: { seguros?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null }) => {
        if (Array.isArray(item.seguros)) {
          return item.seguros[0]?.nombre ?? null;
        }
        return item.seguros?.nombre ?? null;
      })
      .filter((value): value is string => Boolean(value))
      .join(', ');

    return {
      paciente,
      historia: (historiaData as HistoriaClinica | null) ?? null,
      seguro: seguro || null,
      edad: this.calcularEdad(paciente.fecha_nacimiento)
    };
  }

  async listarSeguros(): Promise<Seguro[]> {
    const { data, error } = await supabaseDynamic.from('seguros').select('*').eq('activo', true).order('nombre', { ascending: true });
    this.throwIfError(error);
    return (data ?? []) as Seguro[];
  }

  async listarSegurosPaciente(pacienteId: string): Promise<Seguro[]> {
    const { data, error } = await supabaseDynamic
      .from('paciente_seguros')
      .select('seguro_id, seguros!inner(id,nombre)')
      .eq('paciente_id', pacienteId)
      .eq('activo', true)
      .order('nombre', { ascending: true });
    this.throwIfError(error);
    const seguros = (data ?? []).map((item: any) => {
      if (Array.isArray(item?.seguros)) {
        return item.seguros[0] ?? null;
      }
      return item?.seguros ?? null;
    }) as Array<Seguro | null>;
    return seguros.filter((item): item is Seguro => Boolean(item));
  }

  async guardarSeguroPaciente(pacienteId: string, seguroNombre: string): Promise<void> {
    const nombre = seguroNombre.trim();
    if (!nombre) {
      return;
    }

    const { data: seguroData, error: seguroError } = await supabaseDynamic
      .from('seguros')
      .upsert({ nombre, activo: true }, { onConflict: 'nombre' })
      .select('id')
      .single();
    this.throwIfError(seguroError);

    if (!seguroData) {
      throw new Error('No se pudo crear o recuperar el seguro.');
    }

    const { error: linkError } = await supabaseDynamic
      .from('paciente_seguros')
      .upsert({ paciente_id: pacienteId, seguro_id: seguroData.id, activo: true }, { onConflict: 'paciente_id,seguro_id,numero_poliza' });
    this.throwIfError(linkError);
  }

  async listarDocumentos(pacienteId: string, historiaId: string | null = null): Promise<DocumentoClinico[]> {
    let query = supabaseDynamic.from('archivos_clinicos').select('*').eq('paciente_id', pacienteId).eq('eliminado', false);
    if (historiaId) {
      query = query.eq('historia_id', historiaId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    this.throwIfError(error);
    return Promise.all(((data ?? []) as unknown as DocumentoClinico[]).map(async (documento) => ({
      ...documento,
      url: await this.signedUrl(documento.bucket || (documento.tipo === 'radiografia' ? environment.storageBuckets.radiografias : environment.storageBuckets.documentos), documento.path)
    })));
  }

  async fotoUrl(paciente: Paciente): Promise<string | null> {
    if (!paciente.foto_url) return null;
    const marker = `/object/public/${environment.storageBuckets.pacientes}/`;
    const markerIndex = paciente.foto_url.indexOf(marker);
    if (markerIndex < 0) return paciente.foto_url;
    const path = decodeURIComponent(paciente.foto_url.slice(markerIndex + marker.length));
    return this.signedUrl(environment.storageBuckets.pacientes, path);
  }

  async uploadFoto(pacienteId: string, file: File): Promise<string> {
    const path = buildStoragePath(pacienteId, file);
    const { error } = await supabase.storage.from(environment.storageBuckets.pacientes).upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });
    this.throwStorageError(error);

    const { data } = supabase.storage.from(environment.storageBuckets.pacientes).getPublicUrl(path);
    await this.update(pacienteId, { foto_url: data.publicUrl });
    return data.publicUrl;
  }

  async uploadDocumento(
    pacienteId: string,
    file: File,
    tipo: DocumentoClinicoInsert['tipo'],
    historiaId: string | null = null
  ): Promise<DocumentoClinico> {
    const bucket = tipo === 'radiografia' ? environment.storageBuckets.radiografias : environment.storageBuckets.documentos;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = file.name.split('.').pop() || 'bin';
    const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `${pacienteId}/${historiaId ?? 'general'}/${timestamp}-${safeName}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined });
    this.throwStorageError(error);
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

    const payload = {
      paciente_id: pacienteId,
      historia_id: historiaId,
      tipo,
      nombre: file.name,
      bucket,
      path,
      url: publicData.publicUrl,
      mime_type: file.type || null,
      size: file.size
    };

    const { data, error: insertError } = await supabaseDynamic.from('archivos_clinicos').insert(payload).select('*').single();
    this.throwIfError(insertError);
    return data as unknown as DocumentoClinico;
  }

  async eliminarDocumento(documento: DocumentoClinico): Promise<void> {
    try {
      const bucket = (documento as DocumentoClinico & { bucket?: string }).bucket || environment.storageBuckets.documentos;
      await supabase.storage.from(bucket).remove([documento.path]);
    } catch {
      // Se ignora el fallo de storage y se marca como eliminado en la base de datos.
    }

    const { error } = await supabaseDynamic.from('archivos_clinicos').update({ eliminado: true }).eq('id', documento.id);
    this.throwIfError(error);
  }

  private calcularEdad(fechaNacimiento: string | null): number | null {
    if (!fechaNacimiento) {
      return null;
    }

    const nacimiento = new Date(fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) {
      return null;
    }

    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const aunNoCumple = hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
    return aunNoCumple ? edad - 1 : edad;
  }

  private throwStorageError(error: { message: string } | null): void {
    if (error) {
      throw new Error(error.message);
    }
  }

  private async signedUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    this.throwStorageError(error);
    if (!data?.signedUrl) throw new Error('No se pudo generar el enlace seguro del archivo.');
    return data.signedUrl;
  }

  private validatePayload<T extends PacienteInsert | PacienteUpdate>(payload: T): T {
    const next = { ...payload } as Record<string, any>;
    if ('cedula' in next) {
      next['cedula'] = normalizeWhitespace(next['cedula']);
      if (!next['cedula']) { throw new Error('La cédula es obligatoria.'); }
      if (!isValidEcuadorianCedula(next['cedula'])) { throw new Error('La cédula ingresada no es válida.'); }
    }
    for (const field of ['nombres', 'apellidos']) {
      if (field in next) {
        next[field] = normalizeName(next[field]);
        if (!next[field]) { throw new Error(field === 'nombres' ? 'Los nombres son obligatorios.' : 'Los apellidos son obligatorios.'); }
        if (!TEXT_PATTERN.test(next[field])) { throw new Error('Este campo solo puede contener letras.'); }
      }
    }
    if ('email' in next && next['email']) {
      next['email'] = normalizeEmail(next['email']);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next['email'])) { throw new Error('Ingrese un correo electrónico válido.'); }
    }
    for (const field of ['telefono', 'telefono_emergencia']) {
      if (field in next && next[field] && /\D/.test(next[field])) {
        throw new Error('El teléfono solo puede contener números.');
      }
    }
    return next as T;
  }
}
