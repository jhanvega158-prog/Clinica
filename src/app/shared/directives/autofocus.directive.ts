import { AfterViewInit, Directive, ElementRef } from '@angular/core';

@Directive({ selector: '[appAutofocus]', standalone: true })
export class AutofocusDirective implements AfterViewInit {
  constructor(private readonly element: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.element.nativeElement.focus();
  }
}
