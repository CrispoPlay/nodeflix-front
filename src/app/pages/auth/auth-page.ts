import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LucideLock, LucideLogIn, LucideMail, LucideUser } from '@lucide/angular';
import { AuthService } from '../../core/auth.service';
import { SerieSummary } from '../../core/models';
import { SeriesService } from '../../core/series.service';

@Component({
  selector: 'app-auth-page',
  imports: [CommonModule, FormsModule, LucideLock, LucideLogIn, LucideMail, LucideUser],
  templateUrl: './auth-page.html'
})
export class AuthPage implements OnInit {
  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly popular = signal<SerieSummary[]>([]);

  form = {
    nombre: '',
    correo: '',
    password: ''
  };

  constructor(
    private readonly auth: AuthService,
    private readonly series: SeriesService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    // Si ya está autenticado, verificamos si es usuario nuevo o recurrente antes de redirigir
    if (this.auth.isAuthenticated()) {
      try {
        const interacciones = await firstValueFrom(this.series.getInteracciones());
        if (interacciones && interacciones.length > 0) {
          await this.router.navigate(['/browse']);
        } else {
          await this.router.navigate(['/clips']);
        }
      } catch {
        // Fallback por si la API falla
        await this.router.navigate(['/browse']);
      }
      return;
    }

    try {
      this.popular.set((await firstValueFrom(this.series.getPopulares())).slice(0, 10));
    } catch {
      this.popular.set([]);
    }
  }

  switchMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.error.set('');
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);

    try {
      if (this.mode() === 'register') {
        await this.auth.register(this.form);
      } else {
        await this.auth.login({ correo: this.form.correo, password: this.form.password });
      }

      try {
        const interacciones = await firstValueFrom(this.series.getInteracciones());
        
        if (interacciones && interacciones.length > 0) {
          // Usuario recurrente: Salta directo al menú principal
          await this.router.navigate(['/browse']);
        } else {
          // Usuario nuevo: Lo enviamos al paso 1 del onboarding (Tráilers)
          await this.router.navigate(['/clips']); 
        }
      } catch (error) {
        // Fallback de seguridad si el backend no responde o el historial está vacío
        await this.router.navigate(['/clips']);
      }

    } catch (error) {
      this.error.set(this.extractMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private extractMessage(error: unknown): string {
    if (typeof error === 'object' && error && 'error' in error) {
      const body = (error as { error?: { message?: string } }).error;
      return body?.message ?? 'No se pudo completar la solicitud.';
    }

    return 'No se pudo completar la solicitud.';
  }
}