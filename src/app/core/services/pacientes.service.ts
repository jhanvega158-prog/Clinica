import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BaseRepository } from '../repositories/base.repository';
import { supabase, supabaseDynamic } from '../config/supabase';
import {
  DocumentoClinico,
  DocumentoClinicoInsert,
  Paciente,
  PacienteInsert,
  PacienteUpdate
} from '../models/interfaces/database.types';
import { buildStoragePath } from '../../shared/utils/file-path';

@Injectable({ providedIn: 'root' })
export class PacientesService extends BaseRepository<Paciente, PacienteInsert, PacienteUpdate> {
  constructor() {
    super('pacientes', 'apellidos');
  }

  async search(term: string): Promise<Paciente[]> {
    const value = `%${term}%`;
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .or(`nombres.ilike.${value},apellidos.ilike.${value},cedula.ilike.${value},numero_historia.ilike.${value}`)
      .order('apellidos', { ascending: true });

    this.throwIfError(error);
    return data ?? [];
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
    const path = buildStoragePath(pacienteId, file);
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    this.throwStorageError(error);
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

    const payload: DocumentoClinicoInsert = {
      paciente_id: pacienteId,
      historia_id: historiaId,
      tipo,
      nombre: file.name,
      path,
      url: publicData.publicUrl,
      mime_type: file.type || null,
      size: file.size
    };

    const { data, error: insertError } = await supabaseDynamic.from('documentos_clinicos').insert(payload).select('*').single();
    this.throwIfError(insertError);
    return data as unknown as DocumentoClinico;
  }

  private throwStorageError(error: { message: string } | null): void {
    if (error) {
      throw new Error(error.message);
    }
  }
}
