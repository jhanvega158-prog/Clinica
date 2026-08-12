import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AutofocusDirective } from '../../shared/directives/autofocus.directive';
import { ValidationFeedbackDirective } from '../../shared/directives/validation-feedback.directive';
import { emailTrim, normalizeWhitespace, requiredTrim } from '../../shared/utils/validation.utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AutofocusDirective, ReactiveFormsModule, ValidationFeedbackDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly recoveryMode = signal(false);
  readonly resetMode = computed(() => this.auth.passwordRecovery());
  readonly form = this.fb.nonNullable.group({
    email: ['', [requiredTrim()]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['']
  });

  async submit(): Promise<void> {
    if (this.auth.loading()) {
      return;
    }
    const email = normalizeWhitespace(this.form.controls.email.value);
    this.form.controls.email.setValue(email, { emitEvent: false });
    if (this.recoveryMode()) {
      this.form.controls.email.setErrors(emailTrim()(this.form.controls.email));
      if (this.form.controls.email.invalid) {
        this.form.controls.email.markAsTouched();
        return;
      }
    } else if (this.resetMode()) {
      if (this.form.controls.password.invalid || this.form.controls.password.value !== this.form.controls.confirmPassword.value) {
        this.form.controls.password.markAsTouched();
        this.form.controls.confirmPassword.setErrors({ passwordMismatch: true });
        this.form.controls.confirmPassword.markAsTouched();
        return;
      }
    } else if (this.form.controls.email.invalid || this.form.controls.password.invalid) {
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

      if (this.resetMode()) {
        await this.auth.updatePassword(this.form.controls.password.value);
        this.form.reset({ email: '', password: '', confirmPassword: '' });
        this.toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
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
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
