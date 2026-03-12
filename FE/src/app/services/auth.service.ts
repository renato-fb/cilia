import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserData {
  user_id: number;
  username: string;
  nome_completo: string;
  role: 'user' | 'admin';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  isAuthenticated = signal<boolean>(false);
  currentUser = signal<UserData | null>(null);

  constructor() {
    const storedAuth = localStorage.getItem('ciliaAuthenticated');
    const storedUser = localStorage.getItem('ciliaUser');
    if (storedAuth === 'true' && storedUser) {
      this.isAuthenticated.set(true);
      try {
        this.currentUser.set(JSON.parse(storedUser));
      } catch {
        this.logout();
      }
    }
  }

  login(username: string, password: string): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}?action=login`, { username, password })
      .pipe(
        map(response => {
          if (response.status === 'success') {
            const userData: UserData = {
              user_id: response.user_id,
              username: response.username,
              nome_completo: response.nome_completo,
              role: response.role
            };
            this.isAuthenticated.set(true);
            this.currentUser.set(userData);
            localStorage.setItem('ciliaAuthenticated', 'true');
            localStorage.setItem('ciliaUser', JSON.stringify(userData));
            return true;
          }
          return false;
        }),
        catchError(() => {
          this.isAuthenticated.set(false);
          return of(false);
        })
      );
  }

  logout(): void {
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    localStorage.removeItem('ciliaAuthenticated');
    localStorage.removeItem('ciliaUser');
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }

  getUserId(): number | null {
    return this.currentUser()?.user_id ?? null;
  }
}
