import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AutofocusDirective } from '../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AutofocusDirective, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly recoveryMode = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: ['admin', [Validators.required]],
    password: ['admin', [Validators.required, Validators.minLength(4)]]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      if (this.recoveryMode()) {
        await this.auth.recoverPassword(this.form.controls.email.value);
        this.toast.success('Correo de recuperacion enviado');
        this.recoveryMode.set(false);
        return;
      }

      await this.auth.signIn(this.form.controls.email.value, this.form.controls.password.value);
      this.toast.success('Sesion iniciada');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo iniciar sesion');
    }
  }

  toggleRecovery(): void {
    this.recoveryMode.update((value) => !value);
  }
}
