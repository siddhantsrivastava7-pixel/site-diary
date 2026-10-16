import { describe, expect, it } from 'vitest';
import { createDocument, totalForEstimate, validateDocumentForPdf } from './documents';
import { generateDocumentPdf } from './documentPdf';
import { emptyDocumentFields, validateDocumentFields } from './migration';
import { validateDiary, emptyDiary } from '../../lib/storage';

async function getPdfPageCount(blob: Blob): Promise<number> {
  const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
  const match = text.match(/\/Count\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

describe('Site Diary Documents feature', () => {
  it('migrates old backups without any Documents fields', () => {
    const prev = { version: 1, days: { '2026-10-15': { site: { counts: { civil: 3 }, remarks: '', completed: true, noWorkers: false } } } };
    const migrated = { ...prev, ...validateDocumentFields(prev) };
    expect(migrated.days['2026-10-15'].site.counts.civil).toBe(3);
    expect(migrated.documents).toEqual([]);
    expect(migrated.documentDefaults.letter.name).toBe('SUKRITI INTERIORS');
    expect(emptyDocumentFields().documents).toEqual([]);
  });

  it('preserves existing manpower diary through validateDiary without altering worker counts or sites', () => {
    const rawDiary = {
      version: 1,
      sites: [
        { id: 'site-1', name: 'Sethi Ji', location: 'Kanpur', active: true, createdAt: '2026-10-01' },
        { id: 'site-2', name: 'Mayank Sir', location: '', active: false, createdAt: '2026-10-02', archivedAt: '2026-10-05' }
      ],
      categories: [
        { id: 'civil', name: 'Civil', icon: 'brick', color: 'coral', active: true }
      ],
      days: {
        '2026-10-15': {
          'site-1': { counts: { civil: 5 }, remarks: 'Floor casting', completed: true, noWorkers: false, updatedAt: '2026-10-15T10:00:00Z' }
        }
      },
      updatedAt: '2026-10-15T12:00:00Z'
    };

    const validated = validateDiary(rawDiary);
    expect(validated.sites).toHaveLength(2);
    expect(validated.sites[0].name).toBe('Sethi Ji');
    expect(validated.days['2026-10-15']['site-1'].counts.civil).toBe(5);
    expect(validated.days['2026-10-15']['site-1'].remarks).toBe('Floor casting');
    // Ensure document defaults are properly populated
    expect(validated.documents).toEqual([]);
    expect(validated.documentDefaults.letter.signer).toBe('Juhi Asthana');
    expect(validated.documentDefaults.estimate.name).toBe('ASTHANA ARCHITECT & INTERIOR PVT. LTD.');
  });

  it('keeps site list separate when prospect documents are created', () => {
    const diary = emptyDiary();
    const doc = createDocument('letter');
    doc.clientName = 'Prospect Client';
    doc.projectName = 'Civil Lines Bungalow';
    doc.siteId = ''; // Not tied to any site

    expect(diary.sites).toHaveLength(0);
    diary.documents.push(doc);
    expect(diary.sites).toHaveLength(0); // Diary sites remain untouched
    expect(diary.documents).toHaveLength(1);
  });

  it('calculates itemized estimate totals', () => {
    const doc = createDocument('estimate');
    if (doc.type !== 'estimate') throw new Error('Wrong type');
    doc.pricing = 'itemized';
    doc.sections[0].items[0] = { id: 'x', description: 'Dining table', quantity: 2, unit: 'pc', rate: 11500 };
    expect(totalForEstimate(doc)).toBe(23000);
  });

  it('creates valid 2-page consultancy letter PDF', async () => {
    const doc = createDocument('letter');
    if (doc.type !== 'letter') throw new Error('Wrong type');
    doc.clientName = 'Mr. & Mrs. Kapoor';
    doc.projectName = 'Kapoor Residence';
    doc.clientAddress = 'Plot 42, Civil Lines, Kanpur';
    doc.fee = 650000;
    doc.advancePercent = 40;

    expect(validateDocumentForPdf(doc)).toBeNull();
    const blob = generateDocumentPdf(doc);
    expect(blob.type).toBe('application/pdf');

    const pages = await getPdfPageCount(blob);
    expect(pages).toBeGreaterThanOrEqual(2);
  });

  it('creates valid 1-page estimate PDF', async () => {
    const doc = createDocument('estimate');
    if (doc.type !== 'estimate') throw new Error('Wrong type');
    doc.clientName = 'Anil Gupta';
    doc.projectName = 'Gupta Office';
    doc.pricing = 'lump';
    doc.lumpTotal = 175000;
    doc.sections[0].items[0] = { id: 'i1', description: 'Reception desk and back panel', quantity: 1, unit: 'set', rate: 0 };

    expect(validateDocumentForPdf(doc)).toBeNull();
    const blob = generateDocumentPdf(doc);
    const pages = await getPdfPageCount(blob);
    expect(pages).toBe(1);
    expect(totalForEstimate(doc)).toBe(175000);
  });

  it('creates multi-page estimate PDF with 80 items across multiple rooms', async () => {
    const doc = createDocument('estimate');
    if (doc.type !== 'estimate') throw new Error('Wrong type');
    doc.clientName = 'Deepak Singhania';
    doc.projectName = 'Singhania Villa';
    doc.pricing = 'itemized';

    const sections = [];
    let expectedTotal = 0;
    for (let s = 1; s <= 5; s++) {
      const items = [];
      for (let i = 1; i <= 16; i++) {
        const rate = (s * 1000) + (i * 250);
        expectedTotal += rate;
        items.push({
          id: `item-${s}-${i}`,
          description: `Custom bespoke furniture specification item ${i} for Area ${s} with teak wood finish and polish`,
          quantity: 1,
          unit: 'pc',
          rate
        });
      }
      sections.push({ id: `section-${s}`, title: `Floor ${s} Master Suite & Lobby`, items });
    }
    doc.sections = sections;

    expect(totalForEstimate(doc)).toBe(expectedTotal);
    expect(validateDocumentForPdf(doc)).toBeNull();

    const blob = generateDocumentPdf(doc);
    expect(blob.type).toBe('application/pdf');
    const pages = await getPdfPageCount(blob);
    expect(pages).toBeGreaterThanOrEqual(4);
  });

  it('validates document before PDF generation', () => {
    const letterDoc = createDocument('letter');
    expect(validateDocumentForPdf(letterDoc)).toContain('client name');
    letterDoc.clientName = 'Juhi';
    expect(validateDocumentForPdf(letterDoc)).toContain('site or project name');
    letterDoc.projectName = 'Residence';
    expect(validateDocumentForPdf(letterDoc)).toContain('consultancy fee');

    const estimateDoc = createDocument('estimate');
    estimateDoc.clientName = 'Juhi';
    estimateDoc.projectName = 'Residence';
    expect(validateDocumentForPdf(estimateDoc)).toContain('at least one furniture item');
  });
});

