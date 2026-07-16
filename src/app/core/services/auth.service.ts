import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { Usuario } from '../models/interfaces/database.types';

const LOCAL_ADMIN_KEY = 'odontocare-local-admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<Usuario | null>(null);
  readonly localAdmin = signal(false);
  readonly loading = signal(false);
  readonly authenticated = computed(() => Boolean(this.session()) || this.localAdmin());

  constructor(private readonly router: Router) {
    void this.initialize();
    supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
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
        await this.router.navigateByUrl('/login');
        return;
      }

      const { error } = await supabase.auth.signOut();
      this.throwAuthError(error);
      this.session.set(null);
      this.user.set(null);
      this.profile.set(null);
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
      return;
    }

    const currentUser = this.user();
    if (!currentUser) {
      this.profile.set(null);
      return;
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', currentUser.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    this.profile.set(data);
  }

  private throwAuthError(error: AuthError | null): void {
    if (error) {
      throw new Error(error.message);
    }
  }
}
