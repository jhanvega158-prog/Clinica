import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const TEXT_PATTERN = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ -][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeName(value: string | null | undefined): string {
  return normalizeWhitespace(value);
}

export function normalizeEmail(value: string | null | undefined): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function emptyToNull(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  return normalized ? normalized : null;
}

export function isValidUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function isValidEcuadorianCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) {
    return false;
  }

  const province = Number(value.slice(0, 2));
  const thirdDigit = Number(value[2]);
  if (province < 1 || province > 24 || thirdDigit > 5) {
    return false;
  }

  const digits = value.split('').map(Number);
  const verifier = digits[9];
  const sum = digits.slice(0, 9).reduce((acc, digit, index) => {
    if (index % 2 === 0) {
      const doubled = digit * 2;
      return acc + (doubled > 9 ? doubled - 9 : doubled);
    }
    return acc + digit;
  }, 0);
  const calculated = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return calculated === verifier;
}

export function requiredTrim(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value === 'string') {
      return value.trim() ? null : { required: true };
    }
    return value === null || value === undefined || value === '' ? { required: true } : null;
  };
}

export function notBlankOptional(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return typeof value === 'string' && !value.trim() ? { whitespaceOnly: true } : null;
  };
}

export function minTrimLength(length: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeWhitespace(control.value);
    if (!value) {
      return null;
    }
    return value.length >= length ? null : { minTrimLength: { requiredLength: length } };
  };
}

export function maxTrimLength(length: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeWhitespace(control.value);
    return value.length <= length ? null : { maxTrimLength: { requiredLength: length } };
  };
}

export function personName(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeWhitespace(control.value);
    if (!value) {
      return null;
    }
    return TEXT_PATTERN.test(value) ? null : { nameChars: true };
  };
}

export function ecuadorianCedula(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeWhitespace(control.value);
    if (!value) {
      return null;
    }
    if (/\D/.test(value)) {
      return { cedulaNumeric: true };
    }
    if (value.length !== 10) {
      return { cedulaDigits: true };
    }
    return isValidEcuadorianCedula(value) ? null : { cedulaInvalid: true };
  };
}

export function ecuadorianPhone(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeWhitespace(control.value);
    if (!value) {
      return null;
    }
    if (/\D/.test(value)) {
      return { phoneNumeric: true };
    }
    if (value.length === 10) {
      return value.startsWith('09') ? null : { phoneMobilePrefix: true };
    }
    if (value.length === 9 || value.length === 7) {
      return null;
    }
    return { phoneMobileLength: true };
  };
}

export function emailTrim(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeEmail(control.value);
    if (!value) {
      return null;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? null : { email: true };
  };
}

export function birthDate(maxAge = 120): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeWhitespace(control.value);
    if (!value) {
      return null;
    }
    const date = parseIsoDate(value);
    if (!date) {
      return { invalidDate: true };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date >= today) {
      return { futureDate: true };
    }
    let age = today.getFullYear() - date.getFullYear();
    const beforeBirthday = today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
    if (beforeBirthday) {
      age -= 1;
    }
    return age >= 0 && age <= maxAge ? null : { maxAge: true };
  };
}

export function notFutureDate(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeWhitespace(control.value);
    if (!value) {
      return null;
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return { invalidDate: true };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date <= today ? null : { futureDate: true };
  };
}

export function notPastDate(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeWhitespace(control.value);
    if (!value) {
      return null;
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return { invalidDate: true };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today ? null : { pastDate: true };
  };
}

export function nonNegativeNumber(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? null : { nonNegative: true };
  };
}

export function maxTwoDecimals(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    const text = String(value).trim();
    const number = Number(text);
    return Number.isFinite(number) && /^\d+(?:\.\d{1,2})?$/.test(text)
      ? null
      : { maxTwoDecimals: true };
  };
}

export function integerMin(min = 0): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isInteger(number) && number >= min ? null : { integerMin: { min } };
  };
}

export function allowedValues<T extends string>(values: readonly T[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    return values.includes(control.value) ? null : { invalidOption: true };
  };
}

export function timeRange(startControl = 'hora_inicio', endControl = 'hora_fin'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const start = control.get(startControl)?.value;
    const end = control.get(endControl)?.value;
    if (!start || !end) {
      setControlValidationError(control.get(endControl), 'timeOrder', false);
      return null;
    }
    const invalid = timeToMinutes(end) <= timeToMinutes(start);
    setControlValidationError(control.get(endControl), 'timeOrder', invalid);
    return invalid ? { timeOrder: true } : null;
  };
}

export function emergencyContactPair(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const contact = normalizeWhitespace(control.get('contacto_emergencia')?.value);
    const phone = normalizeWhitespace(control.get('telefono_emergencia')?.value);
    setControlValidationError(control.get('contacto_emergencia'), 'emergencyContactMissing', Boolean(phone && !contact));
    setControlValidationError(control.get('telefono_emergencia'), 'emergencyPhoneMissing', Boolean(contact && !phone));
    if (phone && !contact) {
      return { emergencyContactMissing: true };
    }
    if (contact && !phone) {
      return { emergencyPhoneMissing: true };
    }
    const primaryPhone = normalizeWhitespace(control.get('telefono')?.value);
    setControlValidationError(control.get('telefono_emergencia'), 'emergencySame', Boolean(primaryPhone && phone && primaryPhone === phone));
    if (primaryPhone && phone && primaryPhone === phone) {
      return { emergencySame: true };
    }
    return null;
  };
}

export function validationMessage(controlName: string, errors: ValidationErrors | null | undefined): string | null {
  if (!errors) {
    return null;
  }
  if (errors['required']) {
    return requiredMessage(controlName);
  }
  if (errors['cedulaDigits']) { return 'La cédula debe contener exactamente 10 dígitos.'; }
  if (errors['cedulaNumeric']) { return 'La cédula solo puede contener números.'; }
  if (errors['cedulaInvalid']) { return 'La cédula ingresada no es válida.'; }
  if (errors['duplicateCedula']) { return 'Ya existe un registro con esta cédula.'; }
  if (errors['duplicateEmail']) { return 'Ya existe un registro con este correo electrónico.'; }
  if (errors['duplicateCode']) { return 'Ya existe un producto con este código.'; }
  if (errors['duplicateInvoice']) { return 'Ya existe una factura con este número.'; }
  if (errors['nameChars']) { return 'Este campo solo puede contener letras.'; }
  if (errors['minTrimLength']) { return 'Debe ingresar al menos 2 caracteres.'; }
  if (errors['maxTrimLength']) { return 'El texto ingresado es demasiado largo.'; }
  if (errors['whitespaceOnly']) { return 'Este campo no puede contener solo espacios.'; }
  if (errors['futureDate']) { return controlName === 'fecha_nacimiento' ? 'La fecha de nacimiento debe ser anterior a hoy.' : 'La fecha no puede ser futura.'; }
  if (errors['pastDate']) { return 'La fecha no puede ser anterior a hoy.'; }
  if (errors['invalidDate']) { return controlName === 'fecha_nacimiento' ? 'La fecha de nacimiento ingresada no es válida.' : 'La fecha ingresada no es válida.'; }
  if (errors['maxAge']) { return 'La edad calculada no es válida.'; }
  if (errors['phoneNumeric']) { return 'El teléfono solo puede contener números.'; }
  if (errors['phoneMobileLength']) { return 'El número celular debe contener 10 dígitos.'; }
  if (errors['phoneMobilePrefix']) { return 'El número celular debe comenzar con 09.'; }
  if (errors['email']) { return 'Ingrese un correo electrónico válido.'; }
  if (errors['nonNegative'] || errors['min']) { return 'El valor ingresado no puede ser negativo.'; }
  if (errors['maxTwoDecimals']) { return 'Ingrese un número válido con máximo 2 decimales.'; }
  if (errors['integerMin']) { return 'Ingrese un número entero válido.'; }
  if (errors['invalidOption']) { return 'Seleccione una opción válida.'; }
  if (errors['timeOrder']) { return 'La hora final debe ser posterior a la hora inicial.'; }
  if (errors['emergencySame']) { return 'El teléfono de emergencia debe ser diferente al teléfono principal.'; }
  if (errors['emergencyContactMissing']) { return 'Ingrese el nombre del contacto de emergencia.'; }
  if (errors['emergencyPhoneMissing']) { return 'Ingrese el teléfono del contacto de emergencia.'; }
  if (errors['discountExceedsSubtotal']) { return 'El descuento no puede superar el subtotal.'; }
  if (errors['server']) { return String(errors['server']); }
  return 'Revise este campo antes de continuar.';
}

export function fieldInvalid(control: AbstractControl | null | undefined, submitted = false): boolean {
  return Boolean(control && control.invalid && (control.touched || control.dirty || submitted));
}

export function fieldMessage(controlName: string, control: AbstractControl | null | undefined, submitted = false): string | null {
  if (!fieldInvalid(control, submitted)) {
    return null;
  }
  return validationMessage(controlName, control?.errors);
}

function requiredMessage(controlName: string): string {
  const messages: Record<string, string> = {
    cedula: 'La cédula es obligatoria.',
    nombres: 'Los nombres son obligatorios.',
    apellidos: 'Los apellidos son obligatorios.',
    fecha_nacimiento: 'La fecha de nacimiento es obligatoria.',
    paciente_id: 'Seleccione un paciente.',
    usuario_id: 'Seleccione un odontólogo.',
    motivo: 'El motivo es obligatorio.',
    motivo_consulta: 'El motivo de consulta es obligatorio.',
    diagnostico: 'El diagnóstico es obligatorio.',
    diagnosticos: 'El diagnóstico es obligatorio.',
    procedimiento: 'El tratamiento es obligatorio.',
    numero: 'El número de factura es obligatorio.',
    nombre: 'El nombre del producto es obligatorio.',
    codigo: 'El código es obligatorio.',
    categoria: 'La categoría es obligatoria.',
    stock: 'El stock es obligatorio.',
    stock_minimo: 'El stock mínimo es obligatorio.',
    email: 'El correo electrónico es obligatorio.',
    password: 'La contraseña es obligatoria.'
  };
  return messages[controlName] ?? 'Este campo es obligatorio.';
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function setControlValidationError(control: AbstractControl | null | undefined, key: string, active: boolean): void {
  if (!control) {
    return;
  }
  const errors = { ...(control.errors ?? {}) };
  const currentlyActive = Boolean(errors[key]);
  if (active === currentlyActive) {
    return;
  }
  if (active) {
    errors[key] = true;
  } else {
    delete errors[key];
  }
  control.setErrors(Object.keys(errors).length ? errors : null);
}
