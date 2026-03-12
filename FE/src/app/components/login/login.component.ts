import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [FormsModule, CommonModule, LucideAngularModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
    loading = signal(true);
    showOverlay = signal(true);
    successMessage = signal('');
    errorMessage = signal('');
    username = signal('');
    loginPassword = signal('');
    showLoginPassword = signal(false);

    constructor(private authService: AuthService, private router: Router) { }

    ngOnInit(): void {
        if (this.authService.isAuthenticated()) {
            this.router.navigate(['/dashboard']);
            return;
        }
        setTimeout(() => {
            this.loading.set(false);
            setTimeout(() => this.showOverlay.set(false), 300);
        }, 500);
    }

    handleSubmit(): void {
        this.loading.set(true);
        this.showOverlay.set(true);
        this.successMessage.set('');
        this.errorMessage.set('');

        this.authService.login(this.username(), this.loginPassword()).subscribe({
            next: (success) => {
                if (success) {
                    this.successMessage.set('Redirecionando...');
                    setTimeout(() => {
                        this.router.navigate(['/dashboard']);
                    }, 1000);
                } else {
                    this.errorMessage.set('Usuário ou senha incorretos.');
                    this.loading.set(false);
                    setTimeout(() => this.showOverlay.set(false), 300);
                }
            },
            error: () => {
                this.errorMessage.set('Erro ao conectar com o servidor.');
                this.loading.set(false);
                setTimeout(() => this.showOverlay.set(false), 300);
            }
        });
    }
}
