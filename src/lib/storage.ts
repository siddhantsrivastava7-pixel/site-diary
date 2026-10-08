import type { Category, DiaryData, Entry, Site } from '../types';

export const STORAGE_KEY = 'site-diary-data-v1';
export const defaultCategories: Category[] = [
  { id: 'civil', name: 'Civil', icon: 'brick', color: 'coral', active: true },
  { id: 'electrician', name: 'Electrician', icon: 'zap', color: 'yellow', active: true },
  { id: 'painter', name: 'Painter', icon: 'paint', color: 'blue', active: true },
  { id: 'carpenter', name: 'Carpenter', icon: 'hammer', color: 'peach', active: true },
  { id: 'pop', name: 'POP', icon: 'pop', color: 'violet', active: true },
  { id: 'ramu', name: 'Ramu', icon: 'worker', color: 'mint', active: true }
];
export function emptyDiary(): DiaryData {
  return { version: 1, sites: [], categories: defaultCategories.map(c => ({ ...c })), days: {}, updatedAt: new Date().toISOString() };
}
export function newId(): string { return crypto.randomUUID(); }
export function emptyEntry(): Entry {
  return { counts: {}, remarks: '', completed: false, noWorkers: false, updatedAt: new Date().toISOString() };
}
const plain = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
/** Backups are untrusted. Do not accept arbitrary objects as application state. */
export function validateDiary(raw: unknown): DiaryData {
  if (!plain(raw) || raw.version !== 1 || !Array.isArray(raw.sites) || !Array.isArray(raw.categories) || !plain(raw.days)) throw new Error('Not a supported Site Diary backup.');
  if (raw.sites.length > 2000 || raw.categories.length > 500 || Object.keys(raw.days).length > 5000) throw new Error('This backup is too large.');
  const sites: Site[] = raw.sites.map((s: unknown) => {
    if (!plain(s) || typeof s.id !== 'string' || typeof s.name !== 'string' || s.name.length > 120 || typeof s.active !== 'boolean') throw new Error('Invalid site data.');
    return { id: s.id, name: s.name, location: typeof s.location === 'string' ? s.location.slice(0, 200) : '', active: s.active, createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(), archivedAt: typeof s.archivedAt === 'string' ? s.archivedAt : undefined };
  });
  const categories: Category[] = raw.categories.map((c: unknown) => {
    if (!plain(c) || typeof c.id !== 'string' || typeof c.name !== 'string' || c.name.length > 80 || typeof c.active !== 'boolean') throw new Error('Invalid team data.');
    const icons = ['brick', 'zap', 'paint', 'hammer', 'pop', 'worker', 'wrench', 'building', 'users'];
    return { id: c.id, name: c.name, icon: icons.includes(String(c.icon)) ? c.icon as Category['icon'] : 'users', color: typeof c.color === 'string' ? c.color.slice(0, 30) : 'blue', active: c.active };
  });
  const days: DiaryData['days'] = {};
  for (const [date, records] of Object.entries(raw.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !plain(records)) throw new Error('Invalid report date.');
    days[date] = {};
    for (const [siteId, r] of Object.entries(records)) {
      if (!plain(r) || !plain(r.counts) || typeof r.remarks !== 'string' || typeof r.completed !== 'boolean' || typeof r.noWorkers !== 'boolean') throw new Error('Invalid report entry.');
      const counts: Record<string, number> = {};
      for (const [cid, n] of Object.entries(r.counts)) {
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 99999) throw new Error('Worker counts must be whole numbers.');
        counts[cid] = n;
      }
      const categoryNames: Record<string, string> = {};
      if (plain(r.categoryNames)) for (const [k, v] of Object.entries(r.categoryNames)) if (typeof v === 'string') categoryNames[k] = v.slice(0, 80);
      days[date][siteId] = { counts, remarks: r.remarks.slice(0, 3000), completed: r.completed, noWorkers: r.noWorkers, updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(), siteName: typeof r.siteName === 'string' ? r.siteName.slice(0, 120) : undefined, categoryNames };
    }
  }
  // Site/category identifiers are stored, never user-supplied HTML.
  return { version: 1, sites, categories, days, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString() };
}
export function loadDiary(): DiaryData {
  try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? validateDiary(JSON.parse(saved)) : emptyDiary(); }
  catch { return emptyDiary(); }
}
export function saveDiary(data: DiaryData): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}
export function makeBackup(data: DiaryData): Blob { return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); }
