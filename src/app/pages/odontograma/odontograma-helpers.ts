export type FindingKind = 'caries' | 'restauracion' | 'movilidad' | 'recesion';
export type ToothSurface = 'arriba' | 'derecha' | 'abajo' | 'izquierda' | 'centro';

export const TOOTH_SURFACES: ToothSurface[] = ['arriba', 'derecha', 'abajo', 'izquierda', 'centro'];

const findingColors: Record<FindingKind, string> = {
  caries: '#ef4444',
  restauracion: '#3b82f6',
  movilidad: '#facc15',
  recesion: '#f97316'
};

const surfaceCodes: Record<ToothSurface, string> = { arriba: 'A', derecha: 'D', abajo: 'B', izquierda: 'I', centro: 'C' };
const findingCodes: Record<FindingKind, string> = { caries: 'c', restauracion: 'r', movilidad: 'm', recesion: 'g' };

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
  const condition = (detail?.condicion ?? '').toLowerCase();
  const mobility = Number(detail?.movilidad ?? 0) > 0 || condition.includes('movilidad');
  const recession = Number(detail?.recesion ?? 0) > 0 || condition.includes('recesion');

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

export function parseSurfaceFindings(superficie: string | null | undefined): Partial<Record<ToothSurface, FindingKind>> {
  const value = (superficie ?? '').trim();
  if (value.startsWith('@')) {
    const result: Partial<Record<ToothSurface, FindingKind>> = {};
    const surfaceByCode = Object.fromEntries(Object.entries(surfaceCodes).map(([key, code]) => [code, key])) as Record<string, ToothSurface>;
    const findingByCode = Object.fromEntries(Object.entries(findingCodes).map(([key, code]) => [code, key])) as Record<string, FindingKind>;
    for (const item of value.slice(1).split(',')) {
      const [surfaceCode, findingCode] = item.split(':');
      const surface = surfaceByCode[surfaceCode];
      const finding = findingByCode[findingCode];
      if (surface && finding) result[surface] = finding;
    }
    return result;
  }
  return {};
}

export function serializeSurfaceFindings(states: Partial<Record<ToothSurface, FindingKind>>): string {
  const items = TOOTH_SURFACES
    .filter((surface) => states[surface])
    .map((surface) => `${surfaceCodes[surface]}:${findingCodes[states[surface]!]}`);
  return items.length ? `@${items.join(',')}` : '';
}

export function getSurfaceColor(detail: (ToothDetailSnapshot & { superficie?: string | null }) | null, surface: ToothSurface): string {
  const states = parseSurfaceFindings(detail?.superficie);
  if (Object.keys(states).length) return states[surface] ? findingColors[states[surface]!] : '#ffffff';

  const legacySurface = (detail?.superficie ?? '').toLowerCase();
  const aliases: Record<ToothSurface, string[]> = {
    arriba: ['arriba', 'superior', 'vestibular'], derecha: ['derecha', 'distal'], abajo: ['abajo', 'inferior', 'lingual', 'palatina'],
    izquierda: ['izquierda', 'mesial'], centro: ['centro', 'oclusal', 'incisal']
  };
  const target = TOOTH_SURFACES.find((item) => aliases[item].some((alias) => legacySurface.includes(alias))) ?? 'centro';
  return target === surface ? getToothVisualState(detail).color : '#ffffff';
}
