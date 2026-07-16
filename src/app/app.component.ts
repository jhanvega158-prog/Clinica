import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ToastService } from './core/services/toast.service';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly menuOpen = signal(false);
  readonly links: NavLink[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'D' },
    { path: '/pacientes', label: 'Pacientes', icon: 'P' },
    { path: '/historia-clinica', label: 'Historia clinica', icon: 'H' },
    { path: '/agenda', label: 'Agenda', icon: 'A' },
    { path: '/odontograma', label: 'Odontograma', icon: 'O' },
    { path: '/tratamientos', label: 'Tratamientos', icon: 'T' },
    { path: '/facturacion', label: 'Facturacion', icon: 'F' },
    { path: '/inventario', label: 'Inventario', icon: 'I' },
    { path: '/reportes', label: 'Reportes', icon: 'R' }
  ];

  readonly profileName = computed(() => {
    const profile = this.auth.profile();
    if (!profile) {
      return this.auth.user()?.email ?? 'Usuario';
    }
    return `${profile.nombres} ${profile.apellidos}`.trim();
  });

  readonly initials = computed(() =>
    this.profileName()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
  );

  constructor(
    protected readonly auth: AuthService,
    protected readonly toast: ToastService
  ) {}

  async logout(): Promise<void> {
    try {
      await this.auth.signOut();
      this.toast.info('Sesion cerrada');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo cerrar la sesion');
    }
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
