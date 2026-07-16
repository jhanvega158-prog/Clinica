import { signal } from '@angular/core';
import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { supabaseDynamic } from '../config/supabase';
import { Auditable } from '../models/interfaces/database.types';

export interface EqFilter {
  column: string;
  value: string | number | boolean;
}

export interface ListOptions {
  filters?: EqFilter[];
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

export abstract class BaseRepository<TRow extends Auditable, TInsert extends object, TUpdate extends object> {
  protected readonly client: SupabaseClient = supabaseDynamic;
  readonly loading = signal(false);

  protected constructor(
    protected readonly tableName: string,
    protected readonly defaultOrder = 'created_at'
  ) {}

  async findAll(options: ListOptions = {}): Promise<TRow[]> {
    this.loading.set(true);
    try {
      let query = this.client.from(this.tableName).select('*');

      for (const filter of options.filters ?? []) {
        query = query.eq(filter.column, filter.value);
      }

      query = query.order(options.orderBy ?? this.defaultOrder, {
        ascending: options.ascending ?? false
      });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      this.throwIfError(error);
      return (data ?? []) as unknown as TRow[];
    } finally {
      this.loading.set(false);
    }
  }

  async findById(id: string): Promise<TRow | null> {
    this.loading.set(true);
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      this.throwIfError(error);
      return data as unknown as TRow | null;
    } finally {
      this.loading.set(false);
    }
  }

  async create(payload: TInsert): Promise<TRow> {
    this.loading.set(true);
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert(payload)
        .select('*')
        .single();
      this.throwIfError(error);
      return data as unknown as TRow;
    } finally {
      this.loading.set(false);
    }
  }

  async update(id: string, payload: TUpdate): Promise<TRow> {
    this.loading.set(true);
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      this.throwIfError(error);
      return data as unknown as TRow;
    } finally {
      this.loading.set(false);
    }
  }

  async delete(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const { error } = await this.client.from(this.tableName).delete().eq('id', id);
      this.throwIfError(error);
    } finally {
      this.loading.set(false);
    }
  }

  protected throwIfError(error: PostgrestError | null): void {
    if (error) {
      throw new Error(error.message);
    }
  }
}
