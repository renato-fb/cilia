import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CiliaUser {
  id: number;
  username: string;
  nome_completo: string;
  email: string;
  empresa: string;
  role: string;
  ativo: number;
  created_at: string;
  has_vhsys_keys?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // ---- XML Upload ----
  uploadXml(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('xml_file', file);
    return this.http.post<any>(`${this.apiUrl}?action=parse_xml`, formData);
  }

  // ---- Create OS in VHSYS ----
  createOS(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=criar_os`, data);
  }

  // ---- VHSYS Integrations ----
  searchClient(userId: number, nome: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}?action=buscar_cliente&user_id=${userId}&nome=${encodeURIComponent(nome)}`);
  }

  verifyVhsys(userId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}?action=verificar_vhsys&user_id=${userId}`);
  }

  // ---- Search OS by Budget Number ----
  buscarOSPorOrcamento(userId: number, numero: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}?action=buscar_os_por_orcamento&user_id=${userId}&numero_orcamento=${encodeURIComponent(numero)}`);
  }

  // ---- Import History ----
  getHistory(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?action=historico&user_id=${userId}`);
  }

  // ---- Profile ----
  getProfile(userId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}?action=perfil&user_id=${userId}`);
  }

  changePassword(userId: number, currentPassword: string, newPassword: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}?action=perfil&user_id=${userId}`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  updateProfile(userId: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}?action=perfil&user_id=${userId}`, data);
  }

  // ---- Admin: Users ----
  getUsers(adminId: number): Observable<CiliaUser[]> {
    return this.http.get<CiliaUser[]>(`${this.apiUrl}?action=admin_usuarios&admin_id=${adminId}`);
  }

  createUser(adminId: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=admin_usuarios&admin_id=${adminId}`, data);
  }

  updateUser(adminId: number, userId: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}?action=admin_usuarios&admin_id=${adminId}&id=${userId}`, data);
  }

  deleteUser(adminId: number, userId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}?action=admin_usuarios&admin_id=${adminId}&id=${userId}`);
  }
}
