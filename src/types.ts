export type CategoryIcon = 'brick' | 'zap' | 'paint' | 'hammer' | 'pop' | 'worker' | 'wrench' | 'building' | 'users';
export type Category = { id: string; name: string; icon: CategoryIcon; color: string; active: boolean };
export type Site = { id: string; name: string; location?: string; active: boolean; createdAt: string; archivedAt?: string };
export type Entry = {
  counts: Record<string, number>;
  remarks: string;
  completed: boolean;
  noWorkers: boolean;
  updatedAt: string;
  /** A snapshot preserves previously sent reports when site/team names are changed. */
  siteName?: string;
  categoryNames?: Record<string, string>;
};
export type DiaryData = { version: 1; sites: Site[]; categories: Category[]; days: Record<string, Record<string, Entry>>; updatedAt: string };
export type Page = 'today' | 'history' | 'sites' | 'settings';
export type Panel = { type: 'site'; siteId: string; date: string } | { type: 'report'; date: string } | { type: 'addSite' } | { type: 'editSite'; siteId: string } | { type: 'addCategory' } | { type: 'editCategory'; categoryId: string } | null;
