export function buildStoragePath(entityId: string, file: File): string {
  const cleanName = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .toLowerCase();
  return `${entityId}/${Date.now()}-${cleanName}`;
}
