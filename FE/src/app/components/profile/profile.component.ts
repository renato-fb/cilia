import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="mx-auto">
      <h1 class="text-3xl font-bold text-primary mb-6">Minha Conta</h1>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <svg width="40px" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" class="stroke-primary">
            <g fill="none" fill-rule="evenodd"><g transform="translate(1 1)" stroke-width="2">
              <circle stroke-opacity=".5" cx="18" cy="18" r="18" />
              <path d="M36 18c0-9.94-8.06-18-18-18">
                <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite" />
              </path>
            </g></g>
          </svg>
        </div>
      } @else {
        <!-- Profile Info -->
        <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-red-500 flex items-center justify-center text-white text-2xl font-bold">
              {{ userInitial }}
            </div>
            <div>
              <p class="text-xl font-bold text-primary">{{ profile()?.nome_completo || profile()?.username }}</p>
              <p class="text-gray-500">&#64;{{ profile()?.username }}</p>
              <span class="px-2 py-1 rounded-full text-xs font-bold mt-1 inline-block"
                [ngClass]="profile()?.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'">
                {{ profile()?.role === 'admin' ? 'Administrador' : 'Usuário' }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Email:</span>
              <p class="font-medium text-gray-800">{{ profile()?.email || 'Não informado' }}</p>
            </div>
            <div>
              <span class="text-gray-500">Empresa:</span>
              <p class="font-medium text-gray-800">{{ profile()?.empresa || 'Não informada' }}</p>
            </div>
          </div>
        </div>

        <!-- VHSYS Integration -->
        <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <lucide-icon name="key" class="w-5 h-5"></lucide-icon>
            Integração VHSYS
          </h2>
          <div class="space-y-4 max-w-md">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <input type="text" [(ngModel)]="vhsysAccess"
                class="w-full px-4 py-3 rounded-lg border border-input-border bg-input-bg focus:outline-none focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400"
                placeholder="Cole o Access Token aqui">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Secret Token</label>
              <input type="text" [(ngModel)]="vhsysSecret"
                class="w-full px-4 py-3 rounded-lg border border-input-border bg-input-bg focus:outline-none focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400"
                placeholder="{{ profile()?.has_vhsys_keys ? 'Preencha apenas para alterar a chave existente' : 'Cole o Secret Token aqui' }}">
            </div>
            <p class="text-xs text-secondary mt-1 font-medium">As chaves são obrigatórias para criar Ordem de Serviço.</p>
          </div>
        </div>

        <!-- Change Password -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h2 class="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <lucide-icon name="lock" class="w-5 h-5"></lucide-icon>
            Segurança
          </h2>
          <div class="space-y-4 max-w-md">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
              <input type="password" [(ngModel)]="currentPassword"
                class="w-full px-4 py-3 rounded-lg border border-input-border bg-input-bg focus:outline-none focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400"
                placeholder="Insira sua senha atual">
            </div>
            <!-- Seção de Nova Senha - Oculto por agora
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Nova Senha (opcional)</label>
                  <input type="password" [(ngModel)]="newPassword"
                    class="w-full px-4 py-3 rounded-lg border border-input-border bg-input-bg focus:outline-none focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400"
                    placeholder="Mudar senha">
               </div>
            </div>
            -->
            <button (click)="updateProfile()" [disabled]="saving()"
              class="px-8 py-3 rounded-full bg-primary text-white hover:opacity-90 font-bold disabled:opacity-50 shadow-md transition-all active:scale-95">
              {{ saving() ? 'Salvando...' : 'Salvar Alterações' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  profile = signal<any>(null);
  loading = signal(true);
  currentPassword = signal('');
  newPassword = signal('');
  vhsysAccess = signal('');
  vhsysSecret = signal('');
  saving = signal(false);

  get userInitial(): string {
    const name = this.profile()?.nome_completo || this.profile()?.username || 'U';
    return name.charAt(0).toUpperCase();
  }

  ngOnInit() {
    const userId = this.authService.getUserId();
    if (!userId) return;
    this.apiService.getProfile(userId).subscribe({
      next: (data) => {
        this.profile.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  updateProfile() {
    if (!this.currentPassword() && !this.vhsysAccess() && !this.vhsysSecret()) {
      this.toast.error('Preencha os campos para atualizar.');
      return;
    }
    const userId = this.authService.getUserId();
    if (!userId) return;

    this.saving.set(true);

    const payload: any = {};
    if (this.currentPassword() && this.newPassword()) {
      payload.current_password = this.currentPassword();
      payload.new_password = this.newPassword();
    }

    if (this.vhsysAccess()) payload.vhsys_access_token = this.vhsysAccess();
    if (this.vhsysSecret()) payload.vhsys_secret_token = this.vhsysSecret();

    this.apiService.updateProfile(userId, payload).subscribe({
      next: (res: any) => {
        if (res.status === 'success') {
          this.toast.success('Perfil atualizado com sucesso!');
          this.currentPassword.set('');
          this.newPassword.set('');
          this.vhsysAccess.set('');
          this.vhsysSecret.set('');
          // Reload profile to update "has_vhsys_keys" status
          this.ngOnInit();
        } else {
          this.toast.error(res.message || 'Erro ao atualizar perfil.');
        }
        this.saving.set(false);
      },
      error: (err: any) => {
        this.toast.error(err?.error?.message || 'Erro ao atualizar perfil.');
        this.saving.set(false);
      }
    });
  }
}
