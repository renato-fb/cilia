import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, CiliaUser } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  users = signal<CiliaUser[]>([]);
  loading = signal(false);

  // New user form
  isFormOpen = signal(false);
  editingUser = signal<CiliaUser | null>(null);
  formUsername = signal('');
  formPassword = signal('');
  formNome = signal('');
  formEmail = signal('');
  formEmpresa = signal('');
  formVhsysAccess = signal('');
  formVhsysSecret = signal('');
  saving = signal(false);

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    const adminId = this.authService.getUserId();
    if (!adminId) return;
    this.loading.set(true);
    this.apiService.getUsers(adminId).subscribe({
      next: (data) => {
        this.users.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Erro ao carregar usuários.');
        this.loading.set(false);
      }
    });
  }

  openNewUserForm() {
    this.editingUser.set(null);
    this.formUsername.set('');
    this.formPassword.set('');
    this.formNome.set('');
    this.formEmail.set('');
    this.formEmpresa.set('');
    this.formVhsysAccess.set('');
    this.formVhsysSecret.set('');
    this.isFormOpen.set(true);
  }

  openEditForm(user: CiliaUser) {
    this.editingUser.set(user);
    this.formUsername.set(user.username);
    this.formPassword.set('');
    this.formNome.set(user.nome_completo);
    this.formEmail.set(user.email);
    this.formEmpresa.set(user.empresa);
    // don't set access token back as it's not sent, or we can just leave it blank for them to type new ones
    this.formVhsysAccess.set('');
    this.formVhsysSecret.set('');
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
    this.editingUser.set(null);
  }

  saveUser() {
    const adminId = this.authService.getUserId();
    if (!adminId) return;

    this.saving.set(true);

    if (this.editingUser()) {
      // Update
      const data: any = {
        nome_completo: this.formNome(),
        email: this.formEmail(),
        empresa: this.formEmpresa(),
      };
      if (this.formPassword()) {
        data.password = this.formPassword();
      }
      if (this.formVhsysAccess()) {
        data.vhsys_access_token = this.formVhsysAccess();
      }
      if (this.formVhsysSecret()) {
        data.vhsys_secret_token = this.formVhsysSecret();
      }

      this.apiService.updateUser(adminId, this.editingUser()!.id, data).subscribe({
        next: () => {
          this.toast.success('Usuário atualizado com sucesso!');
          this.closeForm();
          this.loadUsers();
          this.saving.set(false);
        },
        error: () => {
          this.toast.error('Erro ao atualizar usuário.');
          this.saving.set(false);
        }
      });
    } else {
      // Create
      if (!this.formUsername() || !this.formPassword() || !this.formVhsysAccess() || !this.formVhsysSecret()) {
        this.toast.error('Username, Senha e Credenciais VHSYS são obrigatórios.');
        this.saving.set(false);
        return;
      }

      this.apiService.createUser(adminId, {
        username: this.formUsername(),
        password: this.formPassword(),
        nome_completo: this.formNome(),
        email: this.formEmail(),
        empresa: this.formEmpresa(),
        vhsys_access_token: this.formVhsysAccess(),
        vhsys_secret_token: this.formVhsysSecret(),
      }).subscribe({
        next: (res) => {
          if (res.status === 'success') {
            this.toast.success('Usuário criado com sucesso!');
            this.closeForm();
            this.loadUsers();
          } else {
            this.toast.error(res.message || 'Erro ao criar usuário.');
          }
          this.saving.set(false);
        },
        error: (err) => {
          const msg = err?.error?.message || 'Erro ao criar usuário.';
          this.toast.error(msg);
          this.saving.set(false);
        }
      });
    }
  }

  toggleUserStatus(user: CiliaUser) {
    const adminId = this.authService.getUserId();
    if (!adminId) return;

    const newStatus = user.ativo ? 0 : 1;
    this.apiService.updateUser(adminId, user.id, { ativo: newStatus }).subscribe({
      next: () => {
        this.toast.success(newStatus ? 'Usuário ativado.' : 'Usuário desativado.');
        this.loadUsers();
      },
      error: () => this.toast.error('Erro ao alterar status.')
    });
  }

  deleteUser(user: CiliaUser) {
    if (user.role === 'admin') {
      this.toast.error('Não é possível excluir um administrador.');
      return;
    }
    const adminId = this.authService.getUserId();
    if (!adminId) return;

    this.apiService.deleteUser(adminId, user.id).subscribe({
      next: () => {
        this.toast.success('Usuário desativado com sucesso.');
        this.loadUsers();
      },
      error: () => this.toast.error('Erro ao desativar usuário.')
    });
  }

  isFormInvalid(): boolean {
    if (this.saving()) return true;
    if (!this.formUsername() || !this.formNome() || !this.formEmail()) return true;
    
    // In creation mode, password and tokens are mandatory
    if (!this.editingUser()) {
      if (!this.formPassword() || !this.formVhsysAccess() || !this.formVhsysSecret()) return true;
    } else {
      if (!this.formVhsysAccess() || !this.formVhsysSecret()) return true;
    } 
    
    return false;
  }
}
