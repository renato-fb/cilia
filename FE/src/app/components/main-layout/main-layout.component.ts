import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, Router, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../services/auth.service';
import { ToastComponent } from '../shared/toast.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, ToastComponent],
  templateUrl: './main-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  isProfileMenuOpen = signal<boolean>(false);

  get userName(): string {
    return this.authService.currentUser()?.nome_completo ||
           this.authService.currentUser()?.username || 'User';
  }

  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase();
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  toggleProfileMenu() {
    this.isProfileMenuOpen.update(v => !v);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goToProfile() {
    this.isProfileMenuOpen.set(false);
    this.router.navigate(['/profile']);
  }

  goToAdmin() {
    this.isProfileMenuOpen.set(false);
    this.router.navigate(['/admin']);
  }
}
