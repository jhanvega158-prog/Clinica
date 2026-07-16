import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fullName', standalone: true })
export class FullNamePipe implements PipeTransform {
  transform(value: { nombres?: string | null; apellidos?: string | null } | null): string {
    if (!value) {
      return '';
    }

    return [value.nombres, value.apellidos].filter(Boolean).join(' ').trim();
  }
}
