import { describe, it, expect } from 'vitest';
import { todayIST } from './date';
import { emptyDiary, emptyEntry, validateDiary } from './storage';
import { entryTotal, formatReport, reportedDates } from './reports';

describe('daily diary behavior', () => {
  it('uses India dates around UTC midnight', () => {
    expect(todayIST(new Date('2026-10-07T20:00:00Z'))).toBe('2026-10-08');
  });
  it('starts with zero sites and no daily workers', () => {
    const d = emptyDiary();
    expect(d.sites).toHaveLength(0);
    expect(d.days).toEqual({});
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
  it('rejects malformed backup payloads', () => {
    expect(() => validateDiary({ version: 1, sites: [], categories: [], days: { today: {} } })).toThrow();
    expect(() => validateDiary({ version: 2 })).toThrow();
  });
});
