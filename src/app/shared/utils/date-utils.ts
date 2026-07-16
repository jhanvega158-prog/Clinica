export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentTime(): string {
  return new Date().toTimeString().slice(0, 5);
}
