import type { DiaryData, Entry, Site } from '../types';
import { friendlyDate } from './date';

export const entryTotal = (entry?: Entry) => entry ? Object.values(entry.counts).reduce((sum, count) => sum + count, 0) : 0;
export function reportedSites(data: DiaryData, date: string): { site: Site; entry: Entry }[] {
  const records = data.days[date] || {};
  return Object.entries(records)
    .filter(([, entry]) => entry.completed)
    .map(([id, entry]) => ({ site: data.sites.find(s => s.id === id) ?? { id, name: entry.siteName || 'Former site', active: false, createdAt: '' }, entry }))
    .sort((a, b) => a.site.createdAt.localeCompare(b.site.createdAt));
}
export function formatReport(data: DiaryData, date: string): string {
  const sites = reportedSites(data, date);
  const parts = [`*DAILY MANPOWER REPORT*`, friendlyDate(date), ''];
  sites.forEach(({ site, entry }, i) => {
    parts.push(`*${i + 1}. ${entry.siteName || site.name}*`);
    if (entry.noWorkers || entryTotal(entry) === 0) parts.push('No workers today');
    else Object.entries(entry.counts)
      .filter(([, amount]) => amount > 0)
      .forEach(([categoryId, amount]) => parts.push(`${entry.categoryNames?.[categoryId] ?? data.categories.find(c => c.id === categoryId)?.name ?? 'Other'}: ${amount}`));
    parts.push(`Total: ${entryTotal(entry)}`);
    if (entry.remarks.trim()) parts.push(`Remarks: ${entry.remarks.trim()}`);
    parts.push('');
  });
  const grandTotal = sites.reduce((sum, { entry }) => sum + entryTotal(entry), 0);
  parts.push(`*GRAND TOTAL: ${grandTotal} workers*`);
  return parts.join('\n');
}
export function reportedDates(data: DiaryData): string[] {
  return Object.keys(data.days).filter(d => reportedSites(data, d).length > 0).sort().reverse();
}
