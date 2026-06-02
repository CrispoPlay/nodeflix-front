import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { ApiResponse, AuthPayload, LoginCredentials, RegisterPayload, User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'nodeflix_token';
  private readonly userKey = 'nodeflix_user';

  readonly token = signal<string | null>(this.readToken());
  readonly user = signal<User | null>(this.readUser());
  readonly isAuthenticated = computed(() => Boolean(this.token()));

  constructor(private readonly http: HttpClient) {}

  async login(credentials: LoginCredentials): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<AuthPayload>>(`${API_BASE_URL}/user/login`, credentials)
    );

    this.setSession(response.data);
  }

  async register(payload: RegisterPayload): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<User>>(`${API_BASE_URL}/user/registro`, payload));
    await this.login({ correo: payload.correo, password: payload.password });
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.token.set(null);
    this.user.set(null);
  }

  authHeaders(): HttpHeaders {
    const token = this.token();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private setSession(payload: AuthPayload): void {
    localStorage.setItem(this.tokenKey, payload.token);
    localStorage.setItem(this.userKey, JSON.stringify(payload.usuario));
    this.token.set(payload.token);
    this.user.set(payload.usuario);
  }

  private readToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private readUser(): User | null {
    const rawUser = localStorage.getItem(this.userKey);
    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser) as User;
    } catch {
      localStorage.removeItem(this.userKey);
      return null;
    }
  }
}
