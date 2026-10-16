/** Lightweight, dependency-free A4 PDF writer. Documents are generated entirely in-browser.
 * Text uses built-in PDF Helvetica fonts; Unicode outside Windows Latin-1 is transliterated.
 * This avoids uploading client data or relying on a live PDF service.
 */
import type { ConsultancyDoc, DocumentRecord, EstimateDoc } from './types';
import { currency, totalForEstimate } from './documents';
const PW = 595.28, PH = 841.89, M = 43, RIGHT = PW - M;
const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
};
const safe = (s: string) => s.replace(/₹/g, 'Rs. ').replace(/[–—−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/•/g, '-').replace(/…/g, '...').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
const escapePdf = (s: string) => safe(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s);
const joinBytes = (chunks: Uint8Array[]) => {
  const all = new Uint8Array(chunks.reduce((t, c) => t + c.length, 0));
  let i = 0; for (const c of chunks) { all.set(c, i); i += c.length; } return all;
};
const widthOf = (str: string, size: number, bold = false) => {
  // Width budget deliberately conservative, so cross-renderer Helvetica differences don't clip.
  const s = safe(str);
  let approx = 0;
  for (const ch of s) {
    if ('ilI.,;:!|\'` '.includes(ch)) approx += .26;
    else if ('MW@%'.includes(ch)) approx += .88;
    else if ('ABCDEFGHJKLMNOPQRSTUVWXYZ'.includes(ch)) approx += .66;
    else if ('0123456789'.includes(ch)) approx += .56;
    else approx += .51;
  }
  return approx * size * (bold ? 1.06 : 1.04);
};
const wrap = (text: string, maxWidth: number, fontSize: number, bold = false): string[] => {
  const result: string[] = [];
  for (const paragraph of safe(text).split(/\r?\n/)) {
    if (!paragraph.trim()) { result.push(''); continue; }
    let line = '';
    for (let word of paragraph.split(/\s+/)) {
      // Extremely long words / URLs may need to be split.
      while (widthOf(word, fontSize, bold) > maxWidth && word.length > 1) {
        let cut = 1;
        while (cut + 1 < word.length && widthOf(word.slice(0, cut + 1), fontSize, bold) < maxWidth) cut++;
        if (line) { result.push(line); line = ''; }
        result.push(word.slice(0, cut)); word = word.slice(cut);
      }
      const next = line ? line + ' ' + word : word;
      if (line && widthOf(next, fontSize, bold) > maxWidth) { result.push(line); line = word; }
      else line = next;
    }
    result.push(line);
  }
  return result;
};
class DocumentCanvas {
  private pages: string[] = [];
  private ops: string[] = [];
  y = 0;
  constructor(_title: string) { this.nextPage(); }
  private nextPage() { if (this.ops.length) this.pages.push(this.ops.join('\n')); this.ops = []; this.y = 47; }
  pageBreak() { this.nextPage(); }
  ensure(n: number, onNew?: () => void) { if (this.y + n > PH - 65) { this.nextPage(); onNew?.(); } }
  text(text: string, x: number, y: number, size = 10.5, bold = false, color = '#1f2937', align: 'left'|'right'|'center' = 'left') {
    const content = safe(text);
    const left = align === 'left' ? x : align === 'right' ? x - widthOf(content, size, bold) : x - widthOf(content, size, bold) / 2;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size.toFixed(2)} Tf ${rgb(color)} rg 1 0 0 1 ${left.toFixed(2)} ${(PH - y - size).toFixed(2)} Tm (${escapePdf(content)}) Tj ET`);
  }
  line(x1: number, y1: number, x2: number, y2: number, color = '#d1d5db', lineWidth = .7) {
    this.ops.push(`${rgb(color)} RG ${lineWidth.toFixed(2)} w ${x1.toFixed(2)} ${(PH-y1).toFixed(2)} m ${x2.toFixed(2)} ${(PH-y2).toFixed(2)} l S`);
  }
  rect(x: number, y: number, w: number, h: number, fill?: string, stroke?: string, lineWidth = .65) {
    if (fill) this.ops.push(`${rgb(fill)} rg ${x.toFixed(2)} ${(PH-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    if (stroke) this.ops.push(`${rgb(stroke)} RG ${lineWidth.toFixed(2)} w ${x.toFixed(2)} ${(PH-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }
  paragraph(text: string, size = 10.4, x = M, w = PW - 2*M, color = '#26313e', leading = 15, bold = false) {
    const lines = wrap(text, w, size, bold);
    for (const line of lines) { this.ensure(leading); if (line) this.text(line, x, this.y, size, bold, color); this.y += leading; }
  }
  heading(value: string) { this.ensure(43); this.y += 13; this.text(value, M, this.y, 12.1, true, '#202733'); this.y += 21; }
  finish(): Blob {
    if (this.ops.length) this.pages.push(this.ops.join('\n'));
    const objects: Uint8Array[] = [];
    // Objects 1=catalog, 2=pages, 3/4=base fonts. Page/content objects follow.
    const pageIds = this.pages.map((_, idx) => 5 + idx*2);
    objects.push(bytes('<< /Type /Catalog /Pages 2 0 R >>'));
    objects.push(bytes(`<< /Type /Pages /Kids [${pageIds.map(i=>`${i} 0 R`).join(' ')}] /Count ${this.pages.length} >>`));
    objects.push(bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
    objects.push(bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
    this.pages.forEach((page, idx) => {
      const pageId = pageIds[idx];
      objects.push(bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`));
      // Draw page number directly in the page's own content stream.
      const content = `${page}\n${rgb('#8c939e')} rg BT /F1 8 Tf 1 0 0 1 ${RIGHT-50} 31 Tm (Page ${idx+1} of ${this.pages.length}) Tj ET`;
      const stream = bytes(content + '\n');
      objects.push(joinBytes([bytes(`<< /Length ${stream.length} >>\nstream\n`), stream, bytes('endstream') ]));
    });
    const chunks: Uint8Array[] = [bytes('%PDF-1.4\n%\xC2\xA3\xC2\xA4\n')];
    const offsets = [0]; let position = chunks[0].length;
    objects.forEach((object, i) => {
      offsets.push(position);
      const chunk = joinBytes([bytes(`${i+1} 0 obj\n`), object, bytes('\nendobj\n')]);
      chunks.push(chunk); position += chunk.length;
    });
    const xrefStart = position;
    chunks.push(bytes(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));
    // Uint8Array content is already a full, valid PDF; no external dependencies.
    return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
  }
}
const formatDate = (value: string) => {
  const [y, m, d] = value.split('-'); return y && m && d ? `${d}.${m}.${y}` : value;
};
const money = (n: number) => currency(n).replace(/^Rs\. /, 'Rs. ');
const linesOf = (t: string) => t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
function letter(doc: ConsultancyDoc): Blob {
  const c = new DocumentCanvas('Consultancy Letter');
  const b = doc.business;
  c.text(b.name.toUpperCase(), M, 47, Math.min(17, 17*(RIGHT-M)/Math.max(1,widthOf(b.name, 17, true))), true, '#263247');
  c.y = 77;
  c.paragraph(b.address, 9, M, 330, '#526273', 12);
  c.paragraph([b.email, b.phone].filter(Boolean).join('   |   '), 8.8, M, 510, '#526273', 12);
  c.y += 8;
  c.line(M, c.y, RIGHT, c.y, '#d6a54d', 1.6); c.y += 18;
  c.text(`DATE: ${formatDate(doc.date)}`, RIGHT, c.y, 10.2, true, '#3a4451', 'right'); c.y += 24;
  c.text(`To: ${doc.clientName}`, M, c.y, 11.2, true); c.y += 18;
  if (doc.clientAddress.trim()) { c.paragraph(doc.clientAddress, 10.2, M, 510, '#485462', 14); }
  c.y += 15;
  c.paragraph(`Subject: ${doc.subject}`, 11.4, M, 510, '#1d2736', 16, true); c.y += 13;
  c.paragraph(`Dear ${doc.clientName},`, 10.6); c.y += 8;
  const loc = doc.projectName || 'your property';
  const detail = [doc.floors ? `${doc.floors} floors` : '', doc.areaSqFt ? `approx. ${doc.areaSqFt} sq. ft.` : ''].filter(Boolean).join(', ');
  c.paragraph(`It was a pleasure discussing the vision for ${loc}. Based on our site assessment of the property${detail ? ` (${detail})` : ''}, we are pleased to submit this formal proposal for the interior design and execution of your project.`, 10.5); 
  c.heading('1. Scope of Work');
  c.paragraph('Our services encompass the following key areas to ensure a cohesive and premium finish:', 10.4); c.y += 4;
  for (const line of linesOf(doc.scope)) { c.paragraph(`- ${line}`, 10.1, M+12, PW-2*M-14, '#344150', 14.6); c.y += 2; }
  c.heading('2. Execution & Workshop Integration');
  for (const line of linesOf(doc.execution)) { c.paragraph(`- ${line}`, 10.1, M+12, PW-2*M-14, '#344150', 14.6); c.y += 2; }
  c.heading('3. Terms and Conditions');
  for (const part of doc.terms.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean)) {
    const [title, ...paras] = part.split(/\n/);
    c.ensure(62);
    c.paragraph(title, 10.5, M, 510, '#273340', 15.8, true);
    for (const p of paras) c.paragraph(p, 10.1, M+12, PW-2*M-14, '#344150', 14.6);
    c.y += 7;
  }
  c.heading('4. Professional Fees');
  c.paragraph(`Our consultancy fee for ${doc.areaSqFt ? `${doc.areaSqFt} sq. ft. at ` : ''}${doc.projectName} is ${money(doc.fee)}.`, 10.6);
  c.y += 5;
  const advance = Math.round(doc.fee * doc.advancePercent) / 100;
  c.paragraph(`${doc.advancePercent}% advance: ${money(advance)}`, 10.5);
  c.paragraph(`${100 - doc.advancePercent}% balance: ${money(Math.round((doc.fee - advance) * 100) / 100)}`, 10.5);
  c.ensure(92); c.y += 16;
  if (doc.closing.trim()) { c.paragraph(doc.closing, 10.5); c.y += 10; }
  c.paragraph('Warm regards,', 10.5);
  c.paragraph(b.signer, 11.1, M, PW-2*M, '#263247', 15.5, true);
  if (b.role) c.paragraph(b.role, 10.2);
  return c.finish();
}
function estimate(doc: EstimateDoc): Blob {
  const c = new DocumentCanvas('Furniture Estimate');
  const b = doc.business;
  const col = [M, M + 257, M + 365, RIGHT];
  const grid = '#7d858d';
  const header = () => {
    const start = c.y;
    c.rect(M, start, RIGHT - M, 79, '#ffffff', grid);
    const companySize = Math.min(14.2, 14.2 * (RIGHT-M-25) / Math.max(1,widthOf(b.name.toUpperCase(), 14.2, true)));
    c.text(b.name.toUpperCase(), PW/2, start + 8, companySize, true, '#252b33', 'center');
    const address = wrap(b.address, RIGHT - M - 15, 8.8);
    address.slice(0, 2).forEach((line, i) => c.text(line, M + 6, start + 33 + i*11, 8.8, true));
    c.text([b.email, b.phone].filter(Boolean).join(' | ').slice(0, 100), M+6, start + 61, 8.4);
    c.text(`DATE: ${formatDate(doc.date)}`, RIGHT-6, start+61, 9, true, '#253441', 'right');
    c.y += 79;
    const infoStart = c.y;
    const contentW = RIGHT - M - 14;
    const clientRows = wrap(`Client: ${doc.clientName}`, contentW, 10.4, true);
    const projectRows = wrap(`Project: ${doc.projectName} | ${doc.projectType}`, contentW, 9.2);
    const addressRows = doc.clientAddress.trim() ? wrap(`Address: ${doc.clientAddress}`, contentW, 9.2) : [];
    const spaceRows = wrap(`Space: ${doc.space}`, contentW, 9.5);
    const infoHeight = Math.max(137, 8 + clientRows.length*14 + 20 + projectRows.length*12 + addressRows.length*12 + spaceRows.length*13 + 29);
    c.rect(M, infoStart, RIGHT - M, infoHeight, '#ffffff', grid);
    c.y = infoStart + 8;
    c.paragraph(`Client: ${doc.clientName}`, 10.4, M+6, contentW, '#263247', 14, true);
    c.y += 3;
    c.paragraph('Furniture Estimate & Specifications', 10.2, M+6, contentW, '#263247', 15, true);
    c.paragraph(`Project: ${doc.projectName} | ${doc.projectType}`, 9.2, M+6, contentW, '#344150', 12);
    if (doc.clientAddress.trim()) c.paragraph(`Address: ${doc.clientAddress}`, 9.2, M+6, contentW, '#344150', 12);
    c.paragraph(`Space: ${doc.space}`, 9.5, M+6, contentW, '#344150', 13);
    c.text(`Estimated Currency: INR   |   Estimated Total: ${money(totalForEstimate(doc))}`, M+6, infoStart+infoHeight-19, 9.5, true);
    c.y = infoStart+infoHeight;
    tableTitles();
  };
  const tableTitles = () => {
    const top = c.y;
    c.rect(M, top, RIGHT - M, 26, '#f2f4f7', grid);
    c.line(col[1], top, col[1], top+26, grid);
    c.line(col[2], top, col[2], top+26, grid);
    c.text('Item & Description', col[0]+6, top+6, 9.8, true);
    c.text('Qty / Specification', col[1]+6, top+6, 9.2, true);
    c.text('TOTAL', col[2]+6, top+6, 9.8, true);
    c.y += 26;
  };
  header();
  const nextTablePage = () => { c.pageBreak(); c.text(b.name.toUpperCase(), M, c.y, 11, true); c.text('Furniture estimate (continued)', RIGHT, c.y, 9, false, '#667085', 'right'); c.y += 26; tableTitles(); };
  let lineNumber = 0;
  doc.sections.forEach((section) => {
    if (!section.items.some(item => item.description.trim())) return;
    if (c.y + 34 > PH-77) nextTablePage();
    const sectionY = c.y;
    c.rect(M, sectionY, RIGHT - M, 26, '#eaf0ff', grid);
    c.text(section.title || 'Unspecified Area', M+6, sectionY+6, 10.5, true, '#1b4bc2');
    c.y += 26;
    section.items.filter(item => item.description.trim()).forEach((item) => {
      lineNumber++;
      const words = wrap(`${lineNumber}. ${item.description}`, col[1] - col[0] - 12, 9.6);
      const height = Math.max(31, words.length*14 + 13);
      if (c.y + height > PH-77) nextTablePage();
      const y = c.y;
      c.rect(M, y, RIGHT - M, height, '#ffffff', grid);
      c.line(col[1], y, col[1], y+height, grid);
      c.line(col[2], y, col[2], y+height, grid);
      words.forEach((line, lineIdx) => c.text(line, col[0]+6, y+6+lineIdx*14, 9.6));
      c.text(`${item.quantity} ${item.unit}`, col[1]+6, y+7, 9.8);
      if (doc.pricing === 'itemized') c.text(money(item.quantity*item.rate), RIGHT-7, y+7, 9.6, true, '#2a3944', 'right');
      c.y += height;
    });
  });
  if (c.y + 40 > PH-75) nextTablePage();
  const y = c.y;
  c.rect(M, y, RIGHT - M, 38, '#f1f6f4', grid);
  c.text('GRAND TOTAL', col[1]+6, y+10, 10.7, true, '#1e5b47');
  c.text(money(totalForEstimate(doc)), RIGHT-7, y+9, 12.1, true, '#182d29', 'right');
  c.y += 50;
  if (doc.notes.trim()) { c.ensure(58); c.paragraph('Notes:', 10.2, M, PW-2*M, '#334155', 15, true); c.paragraph(doc.notes, 9.8, M, PW-2*M, '#435268', 14); }
  return c.finish();
}
export function generateDocumentPdf(doc: DocumentRecord): Blob {
  return doc.type === 'letter' ? letter(doc) : estimate(doc);
}
