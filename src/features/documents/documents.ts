import type { BusinessDetails, DocumentRecord, DocumentType, EstimateDoc, EstimateSection } from './types';
import { todayIST } from './date';

export const letterBusiness: BusinessDetails = {
  name: 'SUKRITI INTERIORS',
  address: "117/H-1/383, 3rd Floor, 'Asthana Tower', Pandu Nagar, Kanpur",
  email: 'interiorsukriti@gmail.com', phone: '+91 9336274195, +91 7379229400',
  signer: 'Juhi Asthana', role: 'Interior Designer'
};
export const estimateBusiness: BusinessDetails = {
  ...letterBusiness, name: 'ASTHANA ARCHITECT & INTERIOR PVT. LTD.'
};
export const defaultScope = [
  'Designing of New Furniture & Areas: Custom spatial planning and design for all rooms, including bespoke furniture pieces tailored to the scale of your residence.',
  'Technical Documentation: Creation and handling of all project-related drawings, including electrical, plumbing, false ceiling, and detailed furniture elevations.',
  'Site Supervision: Periodic site visits as and when required to ensure that the execution aligns with the approved designs.'
].join('\n');
export const defaultExecution = [
  'In-House Woodwork: To ensure superior quality and finish, all woodwork and cabinetry will be manufactured at our dedicated workshop and then transported to the site for installation.',
  'Contractor Management: All other services (painting, electrical, etc.) will be handled by our trusted contractors.',
  'Billing: Contractor payments and material costs will be settled as per actual bills provided during the project lifecycle.'
].join('\n');
export const defaultTerms = [
  'A. Client Responsibilities\nThe client must provide a clear brief and timely approvals to maintain the project timeline.\nAccess to the site must be provided for measurements and inspections.',
  'B. Revisions and Changes\nThe fee is applicable to the project for only 6 months from the first payment received. In case of delays from the client\'s end, additional hourly charges shall be applicable.\nAny major structural changes requested after the Design Development phase will incur additional hourly charges.',
  'C. Third-Party Contractors\nThe designer is not responsible for delays or defects caused by third-party vendors, though they will assist in quality control.',
  'D. Intellectual Property\nAll drawings and designs remain the intellectual property of the designer. They may be used for the designer\'s professional portfolio and marketing (with client privacy respected).\nAfter project completion, the firm will get professional photoshoots done for their own portfolio (with client privacy respected).',
  'E. Termination Clause\nIn the event of termination, the client shall pay for all work completed up to the termination date.'
].join('\n\n');
export const newEstimateSection = (): EstimateSection => ({ id: id(), title: '', items: [{ id: id(), description: '', quantity: 1, unit: 'pc', rate: 0 }] });
export const id = (): string => crypto.randomUUID();
export const todayInputDate = todayIST;
export function createDocument(type: DocumentType, business?: BusinessDetails): DocumentRecord {
  const common = { id: id(), type, clientName: '', clientAddress: '', projectName: '', siteId: '', date: todayInputDate(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), business: { ...(business || (type === 'letter' ? letterBusiness : estimateBusiness)) } };
  if (type === 'letter') return { ...common, type: 'letter', areaSqFt: '', floors: '', fee: 0, advancePercent: 50, subject: 'Interior Design Consultancy & Execution Proposal - Residential Project', scope: defaultScope, execution: defaultExecution, terms: defaultTerms, closing: 'Looking forward to creating a beautiful home for you.' };
  return { ...common, type: 'estimate', projectType: 'Residential Interior Design', space: 'Residential area', pricing: 'lump', lumpTotal: 0, notes: '', sections: [newEstimateSection()] };
}
export function totalForEstimate(doc: EstimateDoc): number {
  if (doc.pricing === 'lump') return Math.round(doc.lumpTotal * 100) / 100;
  return Math.round(doc.sections.reduce((total, s) => total + s.items.reduce((v, item) => v + (item.quantity * item.rate), 0), 0) * 100) / 100;
}
export function currency(value: number): string {
  return 'Rs. ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: value % 1 ? 2 : 0 }).format(value || 0);
}
export function displayDocumentName(doc: DocumentRecord): string { return doc.clientName.trim() || doc.projectName.trim() || 'Untitled'; }
export function documentFilename(doc: DocumentRecord): string {
  const name = displayDocumentName(doc).replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-').slice(0, 45) || 'Client';
  return `${doc.type === 'letter' ? 'Consultancy-Letter' : 'Furniture-Estimate'}-${name}-${doc.date}.pdf`;
}
export function validateDocument(raw: unknown): DocumentRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid document');
  const d = raw as Record<string, unknown>;
  const text = (key: string, max = 8000) => typeof d[key] === 'string' ? (d[key] as string).slice(0, max) : '';
  const num = (v: unknown, max = 100000000) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : 0;
  if ((d.type !== 'letter' && d.type !== 'estimate') || typeof d.id !== 'string' || d.id.length > 100) throw new Error('Invalid document record');
  const p = d.business && typeof d.business === 'object' && !Array.isArray(d.business) ? d.business as Record<string, unknown> : {};
  const bt = (k: string) => typeof p[k] === 'string' ? (p[k] as string).slice(0, 400) : '';
  const common = { id: d.id, type: d.type, clientName: text('clientName', 140), clientAddress: text('clientAddress', 700), projectName: text('projectName', 140), siteId: text('siteId', 100), date: /^\d{4}-\d{2}-\d{2}$/.test(text('date')) ? text('date') : todayInputDate(), createdAt: text('createdAt', 50) || new Date().toISOString(), updatedAt: text('updatedAt', 50) || new Date().toISOString(), business: { name: bt('name'), address: bt('address'), email: bt('email'), phone: bt('phone'), signer: bt('signer'), role: bt('role') } };
  if (d.type === 'letter') return { ...common, type: 'letter', areaSqFt: text('areaSqFt', 50), floors: text('floors', 100), fee: num(d.fee), advancePercent: num(d.advancePercent, 100), subject: text('subject', 250), scope: text('scope'), execution: text('execution'), terms: text('terms', 15000), closing: text('closing', 500) };
  if (!Array.isArray(d.sections) || d.sections.length > 100) throw new Error('Invalid estimate sections');
  const sections = d.sections.map((s: unknown) => {
    if (!s || typeof s !== 'object') throw new Error('Invalid section');
    const x = s as Record<string, unknown>;
    if (!Array.isArray(x.items) || x.items.length > 500) throw new Error('Too many estimate items');
    return { id: typeof x.id === 'string' ? x.id.slice(0, 100) : id(), title: typeof x.title === 'string' ? x.title.slice(0, 160) : '', items: x.items.map((it: unknown) => {
      if (!it || typeof it !== 'object') throw new Error('Invalid item');
      const a = it as Record<string, unknown>;
      return { id: typeof a.id === 'string' ? a.id.slice(0, 100) : id(), description: typeof a.description === 'string' ? a.description.slice(0, 1500) : '', quantity: num(a.quantity, 999999), unit: typeof a.unit === 'string' ? a.unit.slice(0, 30) : 'pc', rate: num(a.rate) };
    }) };
  });
  return { ...common, type: 'estimate', projectType: text('projectType', 160), space: text('space', 160), pricing: d.pricing === 'itemized' ? 'itemized' : 'lump', lumpTotal: num(d.lumpTotal), notes: text('notes', 3000), sections };
}
export function validateBusiness(raw: unknown, fallback: BusinessDetails): BusinessDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const b = raw as Record<string, unknown>;
  return { name: String(b.name ?? fallback.name).slice(0, 140), address: String(b.address ?? fallback.address).slice(0, 400), email: String(b.email ?? fallback.email).slice(0, 200), phone: String(b.phone ?? fallback.phone).slice(0, 200), signer: String(b.signer ?? fallback.signer).slice(0, 160), role: String(b.role ?? fallback.role).slice(0, 140) };
}
export function validateDocumentForPdf(doc: DocumentRecord): string | null {
  if (!doc.clientName.trim()) return 'Enter the client name.';
  if (!doc.projectName.trim()) return 'Enter the site or project name.';
  if (!doc.business.name.trim()) return 'Enter the company name in Letterhead.';
  if (doc.type === 'letter' && (!Number.isFinite(doc.fee) || doc.fee <= 0)) return 'Enter the consultancy fee.';
  if (doc.type === 'estimate') {
    if (!doc.sections.some(s => s.items.some(i => i.description.trim()))) return 'Add at least one furniture item.';
    if (totalForEstimate(doc) <= 0) return doc.pricing === 'lump' ? 'Enter the total estimated amount.' : 'Enter an item rate to calculate the total.';
  }
  return null;
}
