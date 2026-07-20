export type FindingKind = 'caries' | 'restauracion' | 'movilidad' | 'recesion';

export interface ToothVisualState {
  color: string;
  borderColor: string;
  label: string;
  active: boolean;
}

export interface ToothDetailSnapshot {
  condicion?: string | null;
  movilidad?: number | null;
  recesion?: number | null;
}

export function getToothShape(pieza: number): 'square' | 'circle' {
  return (pieza >= 51 && pieza <= 65) || (pieza >= 71 && pieza <= 85) ? 'circle' : 'square';
}

export function buildConditionCode(caries: boolean, restauracion: boolean): string {
  const parts = [] as string[];
  if (caries) {
    parts.push('caries');
  }
  if (restauracion) {
    parts.push('restauracion');
  }
  return parts.length ? parts.join('|') : 'sin_hallazgo';
}

export function parseConditionCode(condicion: string | null | undefined): { caries: boolean; restauracion: boolean } {
  const normalized = (condicion ?? '').toLowerCase();
  return {
    caries: normalized.includes('caries'),
    restauracion: normalized.includes('restauracion')
  };
}

export function getToothVisualState(detail?: ToothDetailSnapshot | null): ToothVisualState {
  const { caries, restauracion } = parseConditionCode(detail?.condicion);
  const mobility = Number(detail?.movilidad ?? 0) > 0;
  const recession = Number(detail?.recesion ?? 0) > 0;

  if (caries) {
    return { color: '#ef4444', borderColor: '#dc2626', label: 'Caries', active: true };
  }

  if (restauracion) {
    return { color: '#3b82f6', borderColor: '#2563eb', label: 'Restauración', active: true };
  }

  if (mobility) {
    return { color: '#facc15', borderColor: '#ca8a04', label: 'Movilidad', active: true };
  }

  if (recession) {
    return { color: '#f97316', borderColor: '#ea580c', label: 'Recesión', active: true };
  }

  return { color: '#f8fafc', borderColor: '#cbd5e1', label: 'Sin hallazgo', active: false };
}
