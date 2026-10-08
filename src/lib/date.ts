/** Reports use Indian site dates, regardless of the phone's travel timezone. */
export function todayIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function friendlyDate(date: string, short = false): string {
  const parsed = new Date(`${date}T12:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: short ? 'short' : 'long', year: 'numeric', ...(short ? {} : { weekday: 'long' as const }), timeZone: 'Asia/Kolkata' }).format(parsed);
}
export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
