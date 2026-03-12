import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private nextId = 0;

  success(message: string) {
    this.add(message, 'success');
  }

  error(message: string) {
    this.add(message, 'error');
  }

  info(message: string) {
    this.add(message, 'info');
  }

  private add(message: string, type: Toast['type']) {
    const id = this.nextId++;
    this.toasts.update(t => [...t, { id, message, type }]);
    
    // Auto remove after 4 seconds
    setTimeout(() => this.remove(id), 4000);
  }

  remove(id: number) {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }
}
