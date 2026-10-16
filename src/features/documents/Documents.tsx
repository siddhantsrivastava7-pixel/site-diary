import { useEffect, useState } from 'react';
import './documents.css';
import type { ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpenText, Building2, ChevronRight, ClipboardList, Download, Eye, FilePenLine, FileText, MessageCircle, Plus, Save, Share2, Trash2, X } from 'lucide-react';
import type { BusinessDetails, ConsultancyDoc, DocumentHostData, DocumentRecord, DocumentType, EstimateDoc, EstimateSection } from './types';
import { createDocument, currency, displayDocumentName, documentFilename, id, newEstimateSection, totalForEstimate, validateDocumentForPdf } from './documents';
import { generateDocumentPdf } from './documentPdf';

export function Documents<T extends DocumentHostData>({ data, onUpdate, notify }: { data: T; onUpdate: (fn: (prev: T) => T) => void; notify: (text: string) => void }) {
  const [draft, setDraft] = useState<DocumentRecord | null>(null);
  const [dirty, setDirty] = useState(false);
  const [stage, setStage] = useState(0);
  const [showLetterhead, setShowLetterhead] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState<'all' | DocumentType>('all');
  const [saveDefault, setSaveDefault] = useState(false);
  const [working, setWorking] = useState(false);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const updateDraft = (fn: (prev: DocumentRecord) => DocumentRecord) => {
    setDraft(prev => prev ? fn(prev) : null);
    setDirty(true);
    setPreviewUrl(null);
  };
  const patchCommon = (field: 'clientName' | 'clientAddress' | 'projectName' | 'date' | 'siteId', value: string) => updateDraft(prev => ({ ...prev, [field]: value }));
  const patchBusiness = (field: keyof BusinessDetails, value: string) => updateDraft(prev => ({ ...prev, business: { ...prev.business, [field]: value } }));
  const patchLetter = <K extends keyof ConsultancyDoc>(key: K, value: ConsultancyDoc[K]) => updateDraft(prev => prev.type === 'letter' ? { ...prev, [key]: value } : prev);
  const patchEstimate = <K extends keyof EstimateDoc>(key: K, value: EstimateDoc[K]) => updateDraft(prev => prev.type === 'estimate' ? { ...prev, [key]: value } : prev);

  const choose = (doc: DocumentRecord) => { setDraft(structuredClone(doc)); setStage(0); setDirty(false); setShowLetterhead(false); setPreviewUrl(null); setSaveDefault(false); };
  const begin = (kind: DocumentType) => choose(createDocument(kind, data.documentDefaults[kind]));
  const back = () => { if (dirty && !window.confirm('Discard unsaved edits? You can save a draft first.')) return; setDraft(null); setPreviewUrl(null); setDirty(false); };
  const persist = (document: DocumentRecord) => {
    const final: DocumentRecord = { ...document, updatedAt: new Date().toISOString() };
    onUpdate(old => ({ ...old, documents: [final, ...old.documents.filter(x => x.id !== final.id)], ...(saveDefault ? { documentDefaults: { ...old.documentDefaults, [final.type]: { ...final.business } } } : {}) }));
    setDraft(final); setDirty(false);
    return final;
  };
  const save = () => { if (!draft) return; if (!draft.clientName.trim()) { notify('Please enter the client name.'); setStage(0); return; } persist(draft); notify('Document draft saved!'); };
  const remove = (doc: DocumentRecord) => {
    if (!window.confirm(`Delete the ${doc.type === 'letter' ? 'consultancy letter' : 'estimate'} for ${displayDocumentName(doc)}? This cannot be undone.`)) return;
    onUpdate(old => ({ ...old, documents: old.documents.filter(x => x.id !== doc.id) }));
    if (draft?.id === doc.id) setDraft(null);
    notify('Document deleted.');
  };
  const ready = () => { if (!draft) return false; const err = validateDocumentForPdf(draft); if (err) { notify(err); return false; } return true; };
  const createPdf = () => {
    if (!draft || !ready()) return null;
    try { const saved = persist(draft); return { file: new File([generateDocumentPdf(saved)], documentFilename(saved), { type: 'application/pdf' }), doc: saved }; }
    catch (e) { notify(e instanceof Error ? e.message : 'PDF generation failed.'); return null; }
  };
  const preview = () => {
    const result = createPdf(); if (!result) return;
    setPreviewUrl(URL.createObjectURL(result.file)); setStage(2); notify('PDF is ready to review.');
  };
  const download = () => {
    const result = createPdf(); if (!result) return;
    const u = URL.createObjectURL(result.file); const a = document.createElement('a'); a.href = u; a.download = result.file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); notify('PDF downloaded!');
  };
  const sharePdf = async () => {
    const result = createPdf(); if (!result) return;
    setWorking(true);
    try {
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [result.file] })) {
        await navigator.share({ title: result.doc.type === 'letter' ? 'Consultancy Letter' : 'Furniture Estimate', files: [result.file] });
        notify('Choose WhatsApp in the share menu to send the PDF.');
      } else {
        // WhatsApp URLs cannot attach a PDF. The file must be selected from a share sheet or manually attached.
        const u = URL.createObjectURL(result.file); const a = document.createElement('a'); a.href = u; a.download = result.file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
        notify('PDF downloaded. Attach the file in WhatsApp to send it.');
      }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) notify('Could not share. Try Download PDF instead.'); }
    finally { setWorking(false); }
  };
  const linkSite = (siteId: string) => {
    const site = data.sites.find(s => s.id === siteId);
    updateDraft(d => ({ ...d, siteId, projectName: site && !d.projectName.trim() ? site.name : d.projectName, clientAddress: site?.location && !d.clientAddress.trim() ? site.location : d.clientAddress }));
  };
  const updateSection = (sectionId: string, update: (s: EstimateSection) => EstimateSection) => {
    updateDraft(prev => prev.type === 'estimate' ? { ...prev, sections: prev.sections.map(s => s.id === sectionId ? update(s) : s) } : prev);
  };
  const patchItem = (sid: string, iid: string, field: 'description'|'quantity'|'unit'|'rate', value: string | number) => {
    updateSection(sid, s => ({ ...s, items: s.items.map(item => item.id === iid ? { ...item, [field]: value } : item) }));
  };
  const numbers = (e: ChangeEvent<HTMLInputElement>) => Math.max(0, Number(e.target.value) || 0);
  const records = [...data.documents].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).filter(d => docFilter === 'all' || d.type === docFilter);

  if (!draft) return <div className="docs-page">
    <div className="docs-hero"><div className="docs-hero-tag"><FilePenLine size={15}/> A little paperwork magic</div><div className="docs-hero-heading"><div><h1>Documents ✨</h1><p>Lovely letters and estimates, ready to share.</p></div><img src="/illustrations/documents.svg" alt="Illustration of an estimate and letter"/></div></div>
    <div className="section-row"><div><h2>Create a new PDF</h2><p>Pick a template to get started</p></div></div>
    <div className="document-templates">
      <button type="button" className="template-card template-letter" onClick={() => begin('letter')}><span className="template-emoji">✉️</span><div><strong>Consultancy Letter</strong><small>Proposal, scope, fees &amp; terms</small></div><span className="template-next"><ArrowRight size={20}/></span></button>
      <button type="button" className="template-card template-estimate" onClick={() => begin('estimate')}><span className="template-emoji">📋</span><div><strong>Furniture Estimate</strong><small>Rooms, furniture, amounts &amp; total</small></div><span className="template-next"><ArrowRight size={20}/></span></button>
    </div>
    <div className="section-row docs-saved-header"><div><h2>Saved Documents <span className="section-count">{data.documents.length}</span></h2><p>Open, edit or share anytime</p></div></div>
    <div className="segmented docs-filter"><button type="button" className={docFilter === 'all' ? 'selected' : ''} onClick={() => setDocFilter('all')}>All</button><button type="button" className={docFilter === 'letter' ? 'selected' : ''} onClick={() => setDocFilter('letter')}>Letters</button><button type="button" className={docFilter === 'estimate' ? 'selected' : ''} onClick={() => setDocFilter('estimate')}>Estimates</button></div>
    {records.length ? <div className="document-list">{records.map(doc => <div className="document-card" key={doc.id}><button type="button" className="document-open" onClick={() => choose(doc)}><span className={`document-badge ${doc.type}`}>{doc.type === 'letter' ? <BookOpenText size={21}/> : <ClipboardList size={21}/>}</span><span className="document-meta"><strong>{displayDocumentName(doc)}</strong><small>{doc.type === 'letter' ? 'Consultancy Letter' : 'Furniture Estimate'} · {doc.date}</small><small>{doc.projectName || 'Project not specified'}</small></span><ChevronRight size={21}/></button><button className="document-trash" type="button" aria-label={`Delete document for ${displayDocumentName(doc)}`} onClick={() => remove(doc)}><Trash2 size={16}/></button></div>)}</div> : <div className="docs-empty"><FileText size={33}/><strong>No documents yet</strong><p>Choose a template above and make your first PDF.</p></div>}
    <p className="docs-privacy-note">🔒 PDF generation stays on your device. If cloud backup is enabled, saved document details sync to your private Supabase account.</p>
  </div>;

  const isLetter = draft.type === 'letter';
  const stages = ['Client', isLetter ? 'Proposal' : 'Items & Price', 'PDF'];
  return <div className="docs-editor">
    <header className="docs-editor-header"><button type="button" className="docs-back" onClick={back}><ArrowLeft size={22}/><span>Documents</span></button><button type="button" className="docs-save-small" onClick={save}><Save size={17}/> Save</button></header>
    <div className="docs-editor-head"><div className="document-badge large">{isLetter ? '✉️' : '📋'}</div><div><p className="docs-tag">{isLetter ? 'CONSULTANCY LETTER' : 'FURNITURE ESTIMATE'}</p><h2>{draft.clientName.trim() || 'New document'}</h2></div></div>
    <div className="docs-steps" aria-label="Document steps">{stages.map((title, idx) => <button type="button" key={title} className={`${stage === idx ? 'is-current' : ''} ${stage > idx ? 'is-past' : ''}`} onClick={() => setStage(idx)}><span>{idx+1}</span>{title}</button>)}</div>

    {stage === 0 && <section className="docs-fields"><div className="docs-intro"><h3>👋 Who is this for?</h3><p>Enter the new client's details. We'll place them in the document automatically.</p></div>
      <label>Use an existing site <span>(optional)</span><select value={draft.siteId} onChange={e => linkSite(e.target.value)}><option value="">New client / project</option>{data.sites.map(site => <option key={site.id} value={site.id}>{site.name}{site.active ? '' : ' (finished)'}</option>)}</select></label>
      <label>Client's full name <strong>*</strong><input autoComplete="name" maxLength={140} value={draft.clientName} onChange={e => patchCommon('clientName', e.target.value)} placeholder="e.g. Mrs. Sharma"/></label>
      <label>Site / project name <strong>*</strong><input maxLength={140} value={draft.projectName} onChange={e => patchCommon('projectName', e.target.value)} placeholder="e.g. Residence - Pandu Nagar"/></label>
      <label>Client / site address <span>(optional)</span><textarea rows={3} maxLength={700} value={draft.clientAddress} onChange={e => patchCommon('clientAddress', e.target.value)} placeholder="Address to print on the PDF"/></label>
      <label>Document date<input type="date" value={draft.date} onChange={e => patchCommon('date', e.target.value)}/></label>
      <button type="button" className="docs-advanced-toggle" onClick={() => setShowLetterhead(v=>!v)}><Building2 size={18}/> Edit company letterhead <span>{showLetterhead ? '−' : '+'}</span></button>
      {showLetterhead && <div className="docs-letterhead"><label>Company name<input value={draft.business.name} maxLength={140} onChange={e => patchBusiness('name', e.target.value)}/></label><label>Office address<textarea rows={2} value={draft.business.address} maxLength={400} onChange={e => patchBusiness('address', e.target.value)}/></label><label>Email<input type="email" value={draft.business.email} onChange={e => patchBusiness('email', e.target.value)}/></label><label>Phone numbers<input value={draft.business.phone} onChange={e => patchBusiness('phone', e.target.value)}/></label>{isLetter && <><label>Signature name<input value={draft.business.signer} onChange={e => patchBusiness('signer', e.target.value)}/></label><label>Designation<input value={draft.business.role} onChange={e => patchBusiness('role', e.target.value)}/></label></>}<label className="docs-check"><input type="checkbox" checked={saveDefault} onChange={e => setSaveDefault(e.target.checked)}/> Remember this letterhead for new {isLetter ? 'letters' : 'estimates'}</label></div>}
    </section>}

    {stage === 1 && draft.type === 'letter' && <section className="docs-fields"><div className="docs-intro"><h3>✉️ Proposal details</h3><p>Based on your consultancy letter template. You can adjust every term before sending.</p></div>
      <label>Property area (sq. ft.) <span>(optional)</span><input value={draft.areaSqFt} onChange={e => patchLetter('areaSqFt', e.target.value)} placeholder="e.g. 2213"/></label>
      <label>Number of floors <span>(optional)</span><input value={draft.floors} onChange={e => patchLetter('floors', e.target.value)} placeholder="e.g. 3"/></label>
      <label>Consultancy fee (₹) <strong>*</strong><input type="number" min="0" max="100000000" step="0.01" value={draft.fee || ''} onChange={e => patchLetter('fee', numbers(e))} placeholder="e.g. 550000"/></label>
      <label>Advance payment<input type="number" min="0" max="100" step="1" value={draft.advancePercent} onChange={e => patchLetter('advancePercent', Math.min(100,numbers(e)))}/><small>Balance: {100-draft.advancePercent}% · Advance: {currency(draft.fee*draft.advancePercent/100)}</small></label>
      <label>Subject<input value={draft.subject} onChange={e => patchLetter('subject', e.target.value)}/></label>
      <label>1. Scope of Work<textarea rows={7} value={draft.scope} onChange={e => patchLetter('scope', e.target.value)}/></label>
      <label>2. Execution &amp; Workshop Integration<textarea rows={7} value={draft.execution} onChange={e => patchLetter('execution', e.target.value)}/></label>
      <label>3. Terms &amp; Conditions<textarea rows={12} value={draft.terms} onChange={e => patchLetter('terms', e.target.value)}/></label>
      <label>Closing message<textarea rows={2} value={draft.closing} onChange={e => patchLetter('closing', e.target.value)}/></label>
    </section>}

    {stage === 1 && draft.type === 'estimate' && <section className="docs-fields"><div className="docs-intro"><h3>🪑 Furniture details</h3><p>Add each room or floor, then list the furniture and specifications.</p></div>
      <label>Project type<input value={draft.projectType} onChange={e=>patchEstimate('projectType',e.target.value)} placeholder="Residential Interior Design"/></label>
      <label>Space description<input value={draft.space} onChange={e=>patchEstimate('space',e.target.value)} placeholder="Residential area"/></label>
      <div className="docs-section-title"><h3>Rooms &amp; furniture</h3><span>{draft.sections.reduce((sum,s)=>sum+s.items.length,0)} items</span></div>
      {draft.sections.map((section, sectionIndex) => <div className="estimate-section" key={section.id}><div className="estimate-section-head"><span className="estimate-section-number">{sectionIndex+1}</span><input aria-label={`Area ${sectionIndex+1} name`} value={section.title} onChange={e=>updateSection(section.id,s=>({...s,title:e.target.value}))} placeholder="e.g. Ground Floor Lobby"/>{draft.sections.length > 1 && <button type="button" aria-label="Remove area" onClick={()=>patchEstimate('sections',draft.sections.filter(s=>s.id !== section.id))}><X size={17}/></button>}</div>
        {section.items.map((item, i) => <div className="estimate-item" key={item.id}><div className="estimate-item-head"><strong>Item {i+1}</strong><button type="button" aria-label="Remove item" onClick={()=>updateSection(section.id,s=>({...s,items:s.items.filter(it=>it.id !== item.id)}))}><Trash2 size={16}/></button></div><label>Description<input value={item.description} maxLength={1500} onChange={e=>patchItem(section.id,item.id,'description',e.target.value)} placeholder="e.g. TV back panel with wooden frame"/></label><div className="estimate-item-grid"><label>Qty<input type="number" min="0" step="0.01" value={item.quantity} onChange={e=>patchItem(section.id,item.id,'quantity',numbers(e))}/></label><label>Unit<input value={item.unit} onChange={e=>patchItem(section.id,item.id,'unit',e.target.value)} placeholder="pc"/></label>{draft.pricing === 'itemized' && <label>Rate (₹)<input type="number" min="0" step="0.01" value={item.rate || ''} onChange={e=>patchItem(section.id,item.id,'rate',numbers(e))}/></label>}</div>{draft.pricing === 'itemized' && <p className="estimate-subtotal">Subtotal: {currency(item.quantity*item.rate)}</p>}</div>)}
        <button type="button" className="docs-add-inline" onClick={()=>updateSection(section.id,s=>({...s,items:[...s.items,{id:id(),description:'',quantity:1,unit:'pc',rate:0}]}))}><Plus size={17}/> Add furniture item</button></div>)}
      <button type="button" className="docs-add-room" onClick={()=>patchEstimate('sections',[...draft.sections,newEstimateSection()])}><Plus size={19}/> Add another room / floor</button>
      <div className="docs-money-card"><h3>Estimate amount</h3><div className="docs-price-options"><label><input type="radio" name="pricing" checked={draft.pricing === 'lump'} onChange={()=>patchEstimate('pricing','lump')}/> Single total</label><label><input type="radio" name="pricing" checked={draft.pricing === 'itemized'} onChange={()=>patchEstimate('pricing','itemized')}/> Add up item rates</label></div>{draft.pricing === 'lump' && <label>Total amount (₹) <strong>*</strong><input type="number" min="0" step="0.01" value={draft.lumpTotal || ''} onChange={e=>patchEstimate('lumpTotal',numbers(e))} placeholder="e.g. 115000"/></label>}<div className="docs-grand-total"><span>Grand Total</span><strong>{currency(totalForEstimate(draft))}</strong></div></div>
      <label>Extra notes <span>(optional)</span><textarea rows={3} value={draft.notes} onChange={e=>patchEstimate('notes',e.target.value)} placeholder="Any notes to print below the estimate"/></label>
    </section>}

    {stage === 2 && <section className="docs-fields"><div className="docs-intro"><h3>✨ Ready for the PDF?</h3><p>Preview the document, download it, or send it as a PDF attachment using your phone's share menu.</p></div>
      <div className="docs-summary"><div><span>Document</span><strong>{isLetter ? 'Consultancy Letter' : 'Furniture Estimate'}</strong></div><div><span>Client</span><strong>{draft.clientName || 'Not entered'}</strong></div><div><span>Project</span><strong>{draft.projectName || 'Not entered'}</strong></div><div><span>Amount</span><strong>{currency(draft.type === 'letter' ? draft.fee : totalForEstimate(draft))}</strong></div><div><span>Date</span><strong>{draft.date}</strong></div></div>
      <button type="button" className="docs-preview-button" onClick={preview}><Eye size={19}/> Generate &amp; Preview PDF</button>
      {previewUrl && <div className="docs-pdf-preview"><iframe title="Generated document preview" src={previewUrl}/><a href={previewUrl} target="_blank" rel="noreferrer">Open PDF full-screen <ArrowRight size={15}/></a></div>}
      <div className="docs-share-actions"><button type="button" onClick={download}><Download size={19}/> Download PDF</button><button className="docs-whatsapp" type="button" onClick={()=>void sharePdf()} disabled={working}><Share2 size={19}/>{working ? 'Opening share menu…' : 'Share PDF'}</button></div>
      <p className="docs-share-help"><MessageCircle size={15}/> On a phone, choose WhatsApp from the share menu. If file sharing isn't supported, the PDF downloads for manual attachment.</p>
      <button type="button" className="docs-edit-back" onClick={()=>setStage(1)}><FilePenLine size={16}/> Edit document details</button>
    </section>}

    <div className="docs-editor-bottom"><button type="button" className="docs-bottom-prev" onClick={()=>stage === 0 ? back() : setStage(stage-1)}><ArrowLeft size={17}/>{stage === 0 ? 'Cancel' : 'Back'}</button>{stage < 2 ? <button type="button" className="primary-button" onClick={()=>{if (stage === 0 && (!draft.clientName.trim() || !draft.projectName.trim())) {notify('Enter the client and site name first.'); return;}setStage(stage+1);}}>{stage === 1 ? 'Review PDF' : 'Next'}<ArrowRight size={17}/></button> : <button type="button" className="primary-button" onClick={download}><Download size={18}/> Download PDF</button>}</div>
  </div>;
}
