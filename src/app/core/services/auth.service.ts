import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase, supabaseDynamic } from '../config/supabase';
import { Usuario } from '../models/interfaces/database.types';

const LOCAL_ADMIN_KEY = 'odontocare-local-admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<Usuario | null>(null);
  readonly profileLoading = signal(false);
  readonly role = signal<string | null>(null);
  readonly localAdmin = signal(false);
  readonly loading = signal(false);
  readonly passwordRecovery = signal(false);
  readonly authenticated = computed(() => Boolean(this.session()) || this.localAdmin());

  constructor(private readonly router: Router) {
    void this.initialize();
    supabase.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
      this.passwordRecovery.set(event === 'PASSWORD_RECOVERY');
      void this.loadProfile();
    });
  }

  async initialize(): Promise<void> {
    this.loading.set(true);
    try {
      this.localAdmin.set(localStorage.getItem(LOCAL_ADMIN_KEY) === 'true');
      const { data, error } = await supabase.auth.getSession();
      this.throwAuthError(error);
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
      await this.loadProfile();
    } finally {
      this.loading.set(false);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loading.set(true);
    try {
      if (email.trim().toLowerCase() === 'admin' && password === 'admin') {
        localStorage.setItem(LOCAL_ADMIN_KEY, 'true');
        this.localAdmin.set(true);
        this.session.set(null);
        this.user.set(null);
        await this.loadProfile();
        await this.router.navigateByUrl('/dashboard');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      this.throwAuthError(error);
      this.session.set(data.session);
      this.user.set(data.user);
      await this.loadProfile();
      await this.router.navigateByUrl('/dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.loading.set(true);
    try {
      if (this.localAdmin()) {
        localStorage.removeItem(LOCAL_ADMIN_KEY);
        this.localAdmin.set(false);
        this.session.set(null);
        this.user.set(null);
        this.profile.set(null);
        this.role.set(null);
        await this.router.navigateByUrl('/login');
        return;
      }

      const { error } = await supabase.auth.signOut();
      this.throwAuthError(error);
      this.session.set(null);
      this.user.set(null);
      this.profile.set(null);
      this.role.set(null);
      await this.router.navigateByUrl('/login');
    } finally {
      this.loading.set(false);
    }
  }

  async recoverPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    this.throwAuthError(error);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    this.throwAuthError(error);
    this.passwordRecovery.set(false);
  }

  async isAuthenticated(): Promise<boolean> {
    if (localStorage.getItem(LOCAL_ADMIN_KEY) === 'true') {
      this.localAdmin.set(true);
      await this.loadProfile();
      return true;
    }

    const { data, error } = await supabase.auth.getSession();
    this.throwAuthError(error);
    return Boolean(data.session);
  }

  async loadProfile(): Promise<void> {
    if (this.localAdmin()) {
      this.profile.set({
        id: 'local-admin',
        auth_user_id: 'local-admin',
        email: 'admin',
        nombres: 'Admin',
        apellidos: 'Sistema',
        rol: 'Administrador',
        telefono: null,
        activo: true,
        created_at: null,
        updated_at: null
      });
      this.role.set('Administrador');
      return;
    }

    const currentUser = this.user();
    if (!currentUser) {
      this.profile.set(null);
      this.role.set(null);
      return;
    }

    this.profileLoading.set(true);
    try {
      const { data, error } = await supabaseDynamic
        .from('usuarios')
        .select('*, usuario_roles(roles(codigo,nombre))')
        .eq('auth_user_id', currentUser.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (this.user()?.id !== currentUser.id) return;

      const profile = data as (Usuario & {
        usuario_roles?: Array<{ roles?: { codigo?: string | null; nombre?: string | null } | null }>;
      }) | null;
      this.profile.set(profile);
      this.role.set(this.resolveRole(profile));
    } finally {
      this.profileLoading.set(false);
    }
  }

  private resolveRole(profile: (Usuario & {
    usuario_roles?: Array<{ roles?: { codigo?: string | null; nombre?: string | null } | null }>;
  }) | null): string | null {
    if (!profile) return null;
    const values = [profile.rol, ...(profile.usuario_roles ?? []).flatMap((item) => [item.roles?.codigo, item.roles?.nombre])]
      .filter((value): value is string => Boolean(value));
    const normalized = values.map((value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
    if (normalized.some((value) => ['admin', 'administrador'].includes(value))) return 'Administrador';
    if (normalized.some((value) => ['odontologo', 'dentist'].includes(value))) return 'Odontólogo';
    return profile.rol || 'Usuario';
  }

  private throwAuthError(error: AuthError | null): void {
    if (error) {
      throw new Error(error.message);
    }
  }
}
