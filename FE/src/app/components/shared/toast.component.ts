import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-[9999] flex flex-col gap-2 pointer-events-none items-center md:items-end w-full max-w-[320px] md:max-w-none px-4 md:px-0">
      <div *ngFor="let toast of toastService.toasts()" 
           class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border transition-all duration-300 animate-in slide-in-from-bottom-2 md:slide-in-from-right-full w-full md:w-auto"
           [ngClass]="{
             'bg-green-600 border-green-500 text-white shadow-green-900/20': toast.type === 'success',
             'bg-red-600 border-red-500 text-white shadow-red-900/20': toast.type === 'error',
             'bg-blue-600 border-blue-500 text-white shadow-blue-900/20': toast.type === 'info'
           }">
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/20">
          <lucide-icon [name]="toast.type === 'success' ? 'check' : (toast.type === 'error' ? 'alert-triangle' : 'info')" 
                      class="w-5 h-5 text-white"></lucide-icon>
        </div>
        <span class="text-sm font-bold flex-1 text-white">{{ toast.message }}</span>
        <button (click)="toastService.remove(toast.id)" class="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/70">
          <lucide-icon name="x" class="w-4 h-4"></lucide-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    @keyframes slide-in-from-right-full {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slide-in-from-bottom-2 {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-in {
      animation: slide-in-from-bottom-2 0.3s ease-out forwards;
    }
    @media (min-width: 768px) {
      .animate-in {
        animation: slide-in-from-right-full 0.3s ease-out forwards;
      }
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
}
