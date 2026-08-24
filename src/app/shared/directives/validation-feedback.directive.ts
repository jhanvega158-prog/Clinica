import { AfterViewInit, Directive, ElementRef, OnDestroy, Renderer2, inject } from '@angular/core';
import { NgControl, Validators } from '@angular/forms';
import { Subscription, merge } from 'rxjs';
import { fieldMessage, validationMessage } from '../utils/validation.utils';

@Directive({
  selector: 'input[formControlName], textarea[formControlName], select[formControlName]',
  standalone: true
})
export class ValidationFeedbackDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly subscription = new Subscription();
  private errorElement: HTMLElement | null = null;
  private markerElement: HTMLElement | null = null;
  private readonly unlisteners: Array<() => void> = [];

  ngAfterViewInit(): void {
    this.createErrorElement();
    this.createRequiredMarker();
    const control = this.ngControl?.control;
    if (control) {
      this.subscription.add(merge(control.statusChanges, control.valueChanges).subscribe(() => this.render()));
    }
    this.prepareNumericInput();
    this.unlisteners.push(this.renderer.listen(this.elementRef.nativeElement, 'blur', () => {
      this.ngControl?.control?.markAsTouched();
      this.render();
    }));
    this.unlisteners.push(this.renderer.listen(this.elementRef.nativeElement, 'input', () => this.sanitizeNumericInput()));
    queueMicrotask(() => this.render());
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    for (const unlisten of this.unlisteners) {
      unlisten();
    }
  }

  private createErrorElement(): void {
    const parent = this.fieldContainer();
    if (!parent || this.errorElement) {
      return;
    }
    this.errorElement = this.renderer.createElement('p');
    this.renderer.addClass(this.errorElement, 'field-error');
    this.renderer.setAttribute(this.errorElement, 'aria-live', 'polite');
    this.renderer.appendChild(parent, this.errorElement);
  }

  private createRequiredMarker(): void {
    const control = this.ngControl?.control;
    const parent = this.fieldContainer();
    if (!control || !parent || this.markerElement) {
      return;
    }
    const isRequired = control.hasValidator?.(Validators.required) || Boolean(control.errors?.['required'] && validationMessage(this.controlName(), { required: true }));
    if (!isRequired) {
      return;
    }
    this.markerElement = this.renderer.createElement('span');
    this.renderer.addClass(this.markerElement, 'required-mark');
    this.renderer.setProperty(this.markerElement, 'textContent', ' *');
    this.renderer.insertBefore(parent, this.markerElement, this.elementRef.nativeElement);
    this.renderer.addClass(parent, 'field-required');
  }

  private render(): void {
    const control = this.ngControl?.control;
    const parent = this.fieldContainer();
    if (!control || !this.errorElement || !parent) {
      return;
    }

    // Los errores se muestran únicamente si el control fue tocado o modificado.
    // Al intentar guardar, los componentes llaman markAllAsTouched(), por lo que
    // no es necesario depender de FormGroupDirective.submitted, cuyo estado puede
    // permanecer activo después de limpiar o abrir un formulario nuevo.
    const message = fieldMessage(this.controlName(), control, false);
    if (message) {
      this.renderer.addClass(parent, 'field-invalid');
      this.renderer.setProperty(this.errorElement, 'textContent', message);
      this.renderer.setStyle(this.errorElement, 'display', 'block');
      this.renderer.setAttribute(this.elementRef.nativeElement, 'aria-invalid', 'true');
    } else {
      this.renderer.removeClass(parent, 'field-invalid');
      this.renderer.setProperty(this.errorElement, 'textContent', '');
      this.renderer.setStyle(this.errorElement, 'display', 'none');
      this.renderer.removeAttribute(this.elementRef.nativeElement, 'aria-invalid');
    }
  }

  private fieldContainer(): HTMLElement | null {
    return this.elementRef.nativeElement.closest('.field');
  }

  private controlName(): string {
    return String(this.ngControl?.name ?? '');
  }

  private prepareNumericInput(): void {
    if (!this.isNumericOnlyControl()) {
      return;
    }
    this.renderer.setAttribute(this.elementRef.nativeElement, 'inputmode', 'numeric');
    this.renderer.setAttribute(this.elementRef.nativeElement, 'pattern', '[0-9]*');
    this.renderer.setAttribute(this.elementRef.nativeElement, 'maxlength', '10');
  }

  private sanitizeNumericInput(): void {
    if (!this.isNumericOnlyControl()) {
      return;
    }
    const input = this.elementRef.nativeElement as HTMLInputElement;
    const next = input.value.replace(/\D/g, '').slice(0, 10);
    if (input.value === next) {
      return;
    }
    this.renderer.setProperty(input, 'value', next);
    this.ngControl?.control?.setValue(next);
  }

  private isNumericOnlyControl(): boolean {
    return ['cedula', 'telefono', 'telefono_emergencia'].includes(this.controlName());
  }
}
