import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';
import { Paciente, PacienteInsert, SexoPaciente } from '../../core/models/interfaces/database.types';
import { ValidationFeedbackDirective } from '../../shared/directives/validation-feedback.directive';
import {
  allowedValues,
  birthDate,
  ecuadorianCedula,
  ecuadorianPhone,
  emailTrim,
  emergencyContactPair,
  emptyToNull,
  maxTrimLength,
  minTrimLength,
  normalizeEmail,
  normalizeName,
  normalizeWhitespace,
  notBlankOptional,
  personName,
  requiredTrim
} from '../../shared/utils/validation.utils';

@Component({
  selector: 'app-pacientes',
  standalone: true,
  imports: [ReactiveFormsModule, ValidationFeedbackDirective],
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
  readonly hasSearched = signal(false);

  readonly form = this.fb.nonNullable.group({
    numero_historia: ['', [requiredTrim(), maxTrimLength(30)]],
    cedula: ['', [requiredTrim(), ecuadorianCedula()]],
    nombres: ['', [requiredTrim(), personName(), minTrimLength(2), maxTrimLength(80)]],
    apellidos: ['', [requiredTrim(), personName(), minTrimLength(2), maxTrimLength(80)]],
    fecha_nacimiento: ['', [requiredTrim(), birthDate(120)]],
    sexo: ['No especificado' as SexoPaciente, [Validators.required, allowedValues(['Femenino', 'Masculino', 'Otro', 'No especificado'] as const)]],
    telefono: ['', [ecuadorianPhone(), maxTrimLength(10)]],
    email: ['', [emailTrim(), maxTrimLength(120)]],
    direccion: ['', [notBlankOptional(), minTrimLength(5), maxTrimLength(160)]],
    ocupacion: ['', [notBlankOptional(), maxTrimLength(80)]],
    contacto_emergencia: ['', [notBlankOptional(), personName(), minTrimLength(2), maxTrimLength(80)]],
    telefono_emergencia: ['', [ecuadorianPhone(), maxTrimLength(10)]],
    alergias: ['', [notBlankOptional(), maxTrimLength(500)]],
    antecedentes: ['', [notBlankOptional(), maxTrimLength(1000)]],
    activo: [true]
  }, { validators: [emergencyContactPair()] });

  ngOnInit(): void {
    // La consulta se ejecuta únicamente cuando el usuario realiza una búsqueda.
  }

  async load(): Promise<void> {
    if (this.hasSearched() && this.searchTerm()) await this.search(this.searchTerm());
  }

  async search(value: string): Promise<void> {
    const term = normalizeWhitespace(value);
    this.searchTerm.set(term);
    if (!term) { this.pacientes.set([]); this.hasSearched.set(false); return; }
    this.hasSearched.set(true);
    try {
      this.pacientes.set(await this.pacientesService.search(term));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Busqueda no disponible');
    }
  }

  runSearch(input: HTMLInputElement): void { void this.search(input.value); }

  clearSearch(): void {
    this.searchTerm.set('');
    this.hasSearched.set(false);
    this.pacientes.set([]);
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
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  async save(): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.normalizeForm();
    this.validateDuplicados();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: PacienteInsert = {
      numero_historia: normalizeWhitespace(raw.numero_historia),
      cedula: normalizeWhitespace(raw.cedula),
      nombres: normalizeName(raw.nombres),
      apellidos: normalizeName(raw.apellidos),
      fecha_nacimiento: raw.fecha_nacimiento,
      sexo: raw.sexo,
      telefono: emptyToNull(raw.telefono),
      email: emptyToNull(normalizeEmail(raw.email)),
      direccion: emptyToNull(raw.direccion),
      ocupacion: emptyToNull(raw.ocupacion),
      contacto_emergencia: emptyToNull(raw.contacto_emergencia),
      telefono_emergencia: emptyToNull(raw.telefono_emergencia),
      alergias: emptyToNull(raw.alergias),
      antecedentes: emptyToNull(raw.antecedentes),
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
      if (this.hasSearched()) await this.search(this.searchTerm());
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  }

  async remove(paciente: Paciente): Promise<void> {
    if (!window.confirm(`¿Está seguro de eliminar a ${paciente.nombres} ${paciente.apellidos}?`)) return;
    try {
      await this.pacientesService.delete(paciente.id);
      this.toast.success('Paciente eliminado');
      await this.search(this.searchTerm());
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
      if (this.hasSearched()) await this.search(this.searchTerm());
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo subir el archivo');
    }
  }

  private normalizeForm(): void {
    const raw = this.form.getRawValue();
    this.form.patchValue({
      numero_historia: normalizeWhitespace(raw.numero_historia),
      cedula: normalizeWhitespace(raw.cedula),
      nombres: normalizeName(raw.nombres),
      apellidos: normalizeName(raw.apellidos),
      telefono: normalizeWhitespace(raw.telefono),
      email: normalizeEmail(raw.email),
      direccion: normalizeWhitespace(raw.direccion),
      ocupacion: normalizeWhitespace(raw.ocupacion),
      contacto_emergencia: normalizeName(raw.contacto_emergencia),
      telefono_emergencia: normalizeWhitespace(raw.telefono_emergencia),
      alergias: normalizeWhitespace(raw.alergias),
      antecedentes: normalizeWhitespace(raw.antecedentes)
    }, { emitEvent: false });
  }

  private validateDuplicados(): void {
    const raw = this.form.getRawValue();
    const id = this.selectedId();
    const cedula = normalizeWhitespace(raw.cedula);
    const email = normalizeEmail(raw.email);
    this.setControlError('cedula', 'duplicateCedula', this.pacientes().some((paciente) => paciente.cedula === cedula && paciente.id !== id));
    this.setControlError('email', 'duplicateEmail', Boolean(email) && this.pacientes().some((paciente) => normalizeEmail(paciente.email) === email && paciente.id !== id));
  }

  private setControlError(controlName: 'cedula' | 'email', key: string, active: boolean): void {
    const control = this.form.controls[controlName];
    const errors = { ...(control.errors ?? {}) };
    if (active) {
      errors[key] = true;
    } else {
      delete errors[key];
    }
    control.setErrors(Object.keys(errors).length ? errors : null);
  }
}
