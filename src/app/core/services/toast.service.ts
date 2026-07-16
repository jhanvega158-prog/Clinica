import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 1;

  success(text: string): void {
    this.push(text, 'success');
  }

  error(text: string): void {
    this.push(text, 'error');
  }

  info(text: string): void {
    this.push(text, 'info');
  }

  remove(id: number): void {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }

  private push(text: string, type: ToastMessage['type']): void {
    const message: ToastMessage = { id: this.nextId++, text, type };
    this.messages.update((items) => [...items, message]);
    window.setTimeout(() => this.remove(message.id), 3500);
  }
}
