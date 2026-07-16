import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';
import { Paciente, PacienteInsert, SexoPaciente } from '../../core/models/interfaces/database.types';

@Component({
  selector: 'app-pacientes',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './pacientes.component.html',
  styleUrl: './pacientes.component.css'
})
export class PacientesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly pacientesService = inject(PacientesService);
  private readonly toast = inject(ToastService);
  readonly pacientes = signal<Paciente[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.pacientesService.loading;
  readonly searchTerm = signal('');

  readonly form = this.fb.nonNullable.group({
    numero_historia: ['', Validators.required],
    cedula: ['', Validators.required],
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    fecha_nacimiento: [''],
    sexo: ['No especificado' as SexoPaciente, Validators.required],
    telefono: [''],
    email: ['', Validators.email],
    direccion: [''],
    ocupacion: [''],
    contacto_emergencia: [''],
    telefono_emergencia: [''],
    alergias: [''],
    antecedentes: [''],
    activo: [true]
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.pacientes.set(await this.pacientesService.findAll({ orderBy: 'apellidos', ascending: true }));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudieron cargar pacientes');
    }
  }

  async search(value: string): Promise<void> {
    this.searchTerm.set(value);
    try {
      this.pacientes.set(value.trim() ? await this.pacientesService.search(value.trim()) : await this.pacientesService.findAll({ orderBy: 'apellidos', ascending: true }));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Busqueda no disponible');
    }
  }

  handleSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.search(input.value);
  }

  edit(paciente: Paciente): void {
    this.selectedId.set(paciente.id);
    this.form.patchValue({
      ...paciente,
      fecha_nacimiento: paciente.fecha_nacimiento ?? '',
      telefono: paciente.telefono ?? '',
      email: paciente.email ?? '',
      direccion: paciente.direccion ?? '',
      ocupacion: paciente.ocupacion ?? '',
      contacto_emergencia: paciente.contacto_emergencia ?? '',
      telefono_emergencia: paciente.telefono_emergencia ?? '',
      alergias: paciente.alergias ?? '',
      antecedentes: paciente.antecedentes ?? ''
    });
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({
      numero_historia: '',
      cedula: '',
      nombres: '',
      apellidos: '',
      fecha_nacimiento: '',
      sexo: 'No especificado',
      telefono: '',
      email: '',
      direccion: '',
      ocupacion: '',
      contacto_emergencia: '',
      telefono_emergencia: '',
      alergias: '',
      antecedentes: '',
      activo: true
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: PacienteInsert = {
      numero_historia: raw.numero_historia,
      cedula: raw.cedula,
      nombres: raw.nombres,
      apellidos: raw.apellidos,
      fecha_nacimiento: raw.fecha_nacimiento || null,
      sexo: raw.sexo,
      telefono: raw.telefono || null,
      email: raw.email || null,
      direccion: raw.direccion || null,
      ocupacion: raw.ocupacion || null,
      contacto_emergencia: raw.contacto_emergencia || null,
      telefono_emergencia: raw.telefono_emergencia || null,
      alergias: raw.alergias || null,
      antecedentes: raw.antecedentes || null,
      foto_url: null,
      activo: raw.activo
    };

    try {
      const id = this.selectedId();
      if (id) {
        await this.pacientesService.update(id, payload);
        this.toast.success('Paciente actualizado');
      } else {
        await this.pacientesService.create(payload);
        this.toast.success('Paciente creado');
      }
      this.clear();
      await this.load();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  }

  async remove(paciente: Paciente): Promise<void> {
    try {
      await this.pacientesService.delete(paciente.id);
      this.toast.success('Paciente eliminado');
      await this.load();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  }

  async upload(event: Event, paciente: Paciente, tipo: 'foto' | 'radiografia' | 'documento'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (!file) {
      return;
    }

    try {
      if (tipo === 'foto') {
        await this.pacientesService.uploadFoto(paciente.id, file);
      } else {
        await this.pacientesService.uploadDocumento(paciente.id, file, tipo);
      }
      this.toast.success('Archivo subido');
      input.value = '';
      await this.load();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo subir el archivo');
    }
  }
}
