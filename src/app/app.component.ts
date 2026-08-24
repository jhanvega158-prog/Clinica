import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBarChart3,
  LucideCalendarDays,
  LucideDynamicIcon,
  LucideFileText,
  LucideIcon,
  LucideLayoutDashboard,
  LucideLogOut,
  LucidePackage,
  LucideReceipt,
  LucideSmile,
  LucideStethoscope,
  LucideUsers
} from '@lucide/angular';
import { AuthService } from './core/services/auth.service';
import { ToastService } from './core/services/toast.service';

interface NavLink {
  path: string;
  label: string;
  icon: LucideIcon;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, LucideDynamicIcon],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly menuOpen = signal(false);
  readonly logOutIcon = LucideLogOut;
  readonly links: NavLink[] = [
    { path: '/dashboard', label: 'Dashboard', icon: LucideLayoutDashboard },
    { path: '/pacientes', label: 'Pacientes', icon: LucideUsers },
    { path: '/historia-clinica', label: 'Historia Clínica', icon: LucideFileText },
    { path: '/agenda', label: 'Agenda', icon: LucideCalendarDays },
    { path: '/odontograma', label: 'Odontograma', icon: LucideSmile },
    { path: '/tratamientos', label: 'Tratamientos', icon: LucideStethoscope },
    { path: '/facturacion', label: 'Facturación', icon: LucideReceipt },
    { path: '/inventario', label: 'Inventario', icon: LucidePackage },
    { path: '/reportes', label: 'Reportes', icon: LucideBarChart3 }
  ];

  readonly profileName = computed(() => {
    const profile = this.auth.profile();
    if (!profile) {
      return this.auth.user()?.email ?? 'Usuario';
    }
    return `${profile.nombres} ${profile.apellidos}`.trim();
  });

  readonly accountEmail = computed(() =>
    this.auth.user()?.email ?? this.auth.profile()?.email ?? this.profileName()
  );

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
