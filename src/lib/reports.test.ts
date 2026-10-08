import { describe, it, expect } from 'vitest';
import { todayIST } from './date';
import { emptyDiary, emptyEntry, starterSites, validateDiary } from './storage';
import { entryTotal, formatReport, reportedDates } from './reports';

describe('daily diary behavior', () => {
  it('uses India dates around UTC midnight', () => {
    expect(todayIST(new Date('2026-10-07T20:00:00Z'))).toBe('2026-10-08');
  });
  it('starts with zero sites and no daily workers, and provides the 9 starter sites', () => {
    const d = emptyDiary();
    expect(d.sites).toHaveLength(0);
    expect(d.days).toEqual({});
    expect(starterSites).toEqual([
      'Sethi Ji',
      'Usha Singh',
      'Kanodia Ji',
      'Bansal Ji',
      "Tina Ma'am",
      'Mayank Sir',
      'V.S.S.D',
      "Faizy Ma'am",
      'Kuber Sir'
    ]);
  });
  it('formats only positive count categories and keeps remarks', () => {
    const d = emptyDiary();
    d.sites = [{ id: 's', name: 'Sethi Ji', active: true, createdAt: '2026-10-01' }];
    d.days['2026-10-08'] = { s: { ...emptyEntry(), counts: { civil: 3, pop: 0, painter: 2 }, siteName: 'Sethi Ji', categoryNames: { civil: 'Civil', painter: 'Painter' }, remarks: 'Material delayed', completed: true } };
    const report = formatReport(d, '2026-10-08');
    expect(report).toContain('Civil: 3');
    expect(report).toContain('Painter: 2');
    expect(report).not.toContain('POP: 0');
    expect(report).toContain('Remarks: Material delayed');
    expect(report).toContain('GRAND TOTAL: 5 workers');
    expect(entryTotal(d.days['2026-10-08'].s)).toBe(5);
    expect(reportedDates(d)).toEqual(['2026-10-08']);
  });
  it('reports zero-worker days deliberately', () => {
    const d = emptyDiary();
    d.sites = [{ id: 's', name: 'Site A', active: false, createdAt: '2026-10-01' }];
    d.days['2026-10-08'] = { s: { ...emptyEntry(), noWorkers: true, completed: true } };
    expect(formatReport(d, '2026-10-08')).toContain('No workers today');
  });
  it('supports mid-day / partial reports by including only completed sites and skipping unvisited ones', () => {
    const d = emptyDiary();
    d.sites = [
      { id: 's1', name: 'Sethi Ji', active: true, createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 's2', name: 'Usha Singh', active: true, createdAt: '2026-10-01T00:00:00.001Z' },
      { id: 's3', name: 'Kanodia Ji', active: true, createdAt: '2026-10-01T00:00:00.002Z' }
    ];
    d.days['2026-10-08'] = {
      s1: { ...emptyEntry(), counts: { civil: 4 }, siteName: 'Sethi Ji', categoryNames: { civil: 'Civil' }, completed: true },
      s2: { ...emptyEntry(), counts: { painter: 2 }, siteName: 'Usha Singh', completed: false }
    };
    const report = formatReport(d, '2026-10-08');
    expect(report).toContain('Sethi Ji');
    expect(report).not.toContain('Usha Singh');
    expect(report).not.toContain('Kanodia Ji');
    expect(report).toContain('GRAND TOTAL: 4 workers');
  });
  it('rejects malformed backup payloads', () => {
    expect(() => validateDiary({ version: 1, sites: [], categories: [], days: { today: {} } })).toThrow();
    expect(() => validateDiary({ version: 2 })).toThrow();
  });
});
