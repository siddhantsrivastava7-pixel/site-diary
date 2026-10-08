import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ArrowLeft, ArrowRight, Archive, BadgeCheck, BrickWall, Building2, CalendarDays,
  Check, CheckCircle2, ChevronRight, Cloud, CloudOff, Copy,
  Download, FileText, Hammer, HardHat, Heart, History, House, Info, MessageCircle,
  Minus, PaintRoller, Plus, RotateCcw, Search, Settings2, ShieldCheck,
  Sparkles, Sun, Upload, Users, Wrench, X, Zap
} from 'lucide-react';
import type { Category, CategoryIcon, DiaryData, Entry, Page, Panel, Site } from './types';
import { friendlyDate, todayIST } from './lib/date';
import { cloudConfigured, supabase } from './lib/cloud';
import { emptyEntry, loadDiary, makeBackup, newId, saveDiary, starterSites, validateDiary } from './lib/storage';
import { entryTotal, formatReport, reportedDates, reportedSites } from './lib/reports';

const iconTypes = { brick: BrickWall, zap: Zap, paint: PaintRoller, hammer: Hammer, pop: HardHat, worker: Users, wrench: Wrench, building: Building2, users: Users };
const pickColors = ['coral', 'yellow', 'blue', 'peach', 'violet', 'mint'];
const colorOptions: { name: string; value: CategoryIcon }[] = [
  { name: 'Brick', value: 'brick' }, { name: 'Electric', value: 'zap' }, { name: 'Paint', value: 'paint' },
  { name: 'Tools', value: 'hammer' }, { name: 'Helmet', value: 'pop' }, { name: 'People', value: 'worker' },
  { name: 'Repair', value: 'wrench' }, { name: 'Building', value: 'building' }
];
const dateLabel = (day: string) => day === todayIST() ? 'Today' : friendlyDate(day, true);

function TeamGlyph({ kind, size = 21 }: { kind: CategoryIcon; size?: number }) {
  const Icon = iconTypes[kind] || Users;
  return <Icon size={size} strokeWidth={2.2} aria-hidden />;
}
function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return <div className="page-title"><h1>{children}</h1>{subtitle && <p>{subtitle}</p>}</div>;
}
function IconButton({ onClick, label, children, className = '' }: { onClick: () => void; label: string; children: ReactNode; className?: string }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
    <section role="dialog" aria-modal="true" aria-label={title} className="modal-card">
      <div className="modal-header"><h2>{title}</h2><IconButton label="Close" onClick={onClose}><X size={20}/></IconButton></div>
      {children}
    </section>
  </div>;
}

export default function App() {
  const [data, setData] = useState<DiaryData>(loadDiary);
  const [page, setPage] = useState<Page>('today');
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [archivedTab, setArchivedTab] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudMode, setCloudMode] = useState<'off' | 'signed-out' | 'loading' | 'choose' | 'ready' | 'error'>(cloudConfigured ? 'loading' : 'off');
  const [remote, setRemote] = useState<DiaryData | null>(null);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [onlineSeq, setOnlineSeq] = useState(0);
  const cloudWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const [cloudError, setCloudError] = useState('');
  const [loginSent, setLoginSent] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const currentDataRef = useRef(data);
  const [day, setDay] = useState(todayIST);
  useEffect(() => {
    const checkDay = () => setDay(todayIST());
    const timer = window.setInterval(checkDay, 30_000);
    window.addEventListener('focus', checkDay);
    document.addEventListener('visibilitychange', checkDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', checkDay); document.removeEventListener('visibilitychange', checkDay); };
  }, []);

  useEffect(() => { currentDataRef.current = data; setStorageError(!saveDiary(data)); }, [data]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data: auth }) => { if (active) { setCloudUser(auth.user); if (!auth.user) setCloudMode('signed-out'); } }).catch(() => { if (active) setCloudMode('error'); });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setCloudUser(session?.user ?? null);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    if (!cloudUser) { setCloudMode('signed-out'); setCloudEnabled(false); setRemote(null); return; }
    let canceled = false;
    setCloudMode('loading');
    setCloudEnabled(false);
    supabase.from('site_diary_data').select('payload').eq('user_id', cloudUser.id).maybeSingle().then(async ({ data: row, error }) => {
      if (canceled) return;
      if (error) { setCloudError(error.message); setCloudMode('error'); return; }
      if (row?.payload) {
        try {
          const cloudDiary = validateDiary(row.payload);
          if (cloudDiary.updatedAt === currentDataRef.current.updatedAt) {
            setCloudMode('ready'); setCloudEnabled(true);
          } else { setRemote(cloudDiary); setCloudMode('choose'); }
        }
        catch { setCloudError('Cloud backup was not readable. Your device data is safe.'); setCloudMode('error'); }
      } else {
        const result = await supabase!.from('site_diary_data').upsert({ user_id: cloudUser.id, payload: currentDataRef.current }, { onConflict: 'user_id' });
        if (canceled) return;
        if (result.error) { setCloudError(result.error.message); setCloudMode('error'); }
        else { setCloudMode('ready'); setCloudEnabled(true); }
      }
    });
    return () => { canceled = true; };
  }, [cloudUser?.id]);
  useEffect(() => {
    const onOnline = () => setOnlineSeq(n => n + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
  useEffect(() => {
    if (!cloudEnabled || !cloudUser || !supabase) return;
    const client = supabase;
    const userId = cloudUser.id;
    const payload = data;
    const timer = setTimeout(() => {
      // Serialize saves, so a slower old request cannot overwrite a newer one.
      cloudWriteQueue.current = cloudWriteQueue.current.catch(() => {}).then(async () => {
        setCloudSaving(true);
        const result = await client.from('site_diary_data').upsert({ user_id: userId, payload }, { onConflict: 'user_id' });
        setCloudSaving(false);
        if (result.error) setCloudError(`Cloud backup couldn't save: ${result.error.message}`);
        else setCloudError('');
      });
    }, 1400);
    return () => clearTimeout(timer);
  }, [data, cloudEnabled, cloudUser?.id, onlineSeq]);

  const update = (fn: (prev: DiaryData) => DiaryData) => setData(prev => ({ ...fn(prev), updatedAt: new Date().toISOString() }));
  const activeSites = data.sites.filter(s => s.active);
  const completeCount = activeSites.filter(s => data.days[day]?.[s.id]?.completed).length;
  const todayTotal = activeSites.reduce((acc, s) => acc + (data.days[day]?.[s.id]?.completed ? entryTotal(data.days[day][s.id]) : 0), 0);
  const isReadyToShare = activeSites.length > 0 && completeCount === activeSites.length;
  const completionPercent = activeSites.length ? Math.round((completeCount / activeSites.length) * 100) : 0;
  const [returnToEntry, setReturnToEntry] = useState<{ type: 'site'; siteId: string; date: string } | null>(null);
  const [returnToReport, setReturnToReport] = useState<string | null>(null);
  const closePanel = () => {
    if ((panel?.type === 'addCategory' || panel?.type === 'editCategory') && returnToEntry) { setPanel(returnToEntry); setReturnToEntry(null); }
    else if (panel?.type === 'site' && returnToReport === panel.date) { setPanel({ type: 'report', date: panel.date }); setReturnToReport(null); }
    else { setPanel(null); setReturnToReport(null); }
  };
  const openCategoryFromEntry = (siteId: string, date: string) => { setReturnToEntry({ type: 'site', siteId, date }); setPanel({ type: 'addCategory' }); };
  const showToast = (msg: string) => setToast(msg);

  const getEntry = (siteId: string, forDate: string): Entry => data.days[forDate]?.[siteId] || emptyEntry();
  const updateEntry = (siteId: string, forDate: string, change: (entry: Entry) => Entry) => {
    update(prev => {
      const old = prev.days[forDate]?.[siteId] || emptyEntry();
      const changed = change(old);
      return { ...prev, days: { ...prev.days, [forDate]: { ...(prev.days[forDate] || {}), [siteId]: { ...changed, completed: false, noWorkers: false, updatedAt: new Date().toISOString() } } } };
    });
  };
  const markComplete = (siteId: string, forDate: string, noWorkers = false) => {
    update(prev => {
      const entry = prev.days[forDate]?.[siteId] || emptyEntry();
      const site = prev.sites.find(s => s.id === siteId);
      const snap: Record<string, string> = { ...(entry.categoryNames || {}) };
      Object.keys(entry.counts).forEach(key => { snap[key] = prev.categories.find(c => c.id === key)?.name || snap[key] || 'Other'; });
      return { ...prev, days: { ...prev.days, [forDate]: { ...(prev.days[forDate] || {}), [siteId]: { ...entry, counts: noWorkers ? {} : entry.counts, siteName: entry.siteName || site?.name || 'Site', categoryNames: snap, noWorkers, completed: true, updatedAt: new Date().toISOString() } } } };
    });
    showToast('Site saved!');
    if (returnToReport === forDate) { setPanel({ type: 'report', date: forDate }); setReturnToReport(null); }
    else setPanel(null);
  };
  const addSite = (name: string, location: string) => {
    const safeName = name.trim();
    if (!safeName) return false;
    if (data.sites.some(s => s.active && s.name.toLocaleLowerCase() === safeName.toLocaleLowerCase())) { showToast('This site already exists.'); return false; }
    const archived = data.sites.find(s => !s.active && s.name.toLocaleLowerCase() === safeName.toLocaleLowerCase());
    if (archived) {
      update(prev => ({ ...prev, sites: prev.sites.map(s => s.id === archived.id ? { ...s, active: true, archivedAt: undefined, location: location.trim() || s.location } : s) }));
    } else {
      update(prev => ({ ...prev, sites: [...prev.sites, { id: newId(), name: safeName, location: location.trim(), active: true, createdAt: new Date().toISOString() }] }));
    }
    showToast(`${safeName} added!`);
    setPanel(null);
    return true;
  };
  const addStarterSites = (names: string[]) => {
    const clean = names.map(n => n.trim()).filter(Boolean);
    if (!clean.length) return;
    const baseTime = Date.now();
    update(prev => {
      const nextSites = prev.sites.map(s => ({ ...s }));
      clean.forEach((siteName, index) => {
        const existing = nextSites.find(s => s.name.toLocaleLowerCase() === siteName.toLocaleLowerCase());
        if (existing) {
          existing.active = true;
          existing.archivedAt = undefined;
        } else {
          nextSites.push({ id: newId(), name: siteName, location: '', active: true, createdAt: new Date(baseTime + index).toISOString() });
        }
      });
      return { ...prev, sites: nextSites };
    });
    showToast(`${clean.length} ${clean.length === 1 ? 'site' : 'sites'} ready for today!`);
  };
  const editSite = (id: string, name: string, location: string) => {
    if (!name.trim()) return;
    update(prev => ({ ...prev, sites: prev.sites.map(s => s.id === id ? { ...s, name: name.trim(), location: location.trim() } : s) }));
    showToast('Site updated.'); closePanel();
  };
  const archiveSite = (site: Site) => {
    if (!window.confirm(`Remove “${site.name}” from today's active sites?\n\nAny old reports for this site will remain safely saved.`)) return;
    update(prev => ({ ...prev, sites: prev.sites.map(s => s.id === site.id ? { ...s, active: false, archivedAt: new Date().toISOString() } : s) }));
    showToast(`${site.name} removed from active sites.`);
    closePanel();
  };
  const restoreSite = (site: Site) => {
    update(prev => ({ ...prev, sites: prev.sites.map(s => s.id === site.id ? { ...s, active: true, archivedAt: undefined } : s) }));
    showToast('Site is active again.');
  };
  const saveCategory = (value: { name: string; icon: CategoryIcon; color: string }, id?: string) => {
    if (!value.name.trim()) return;
    if (data.categories.some(c => c.id !== id && c.active && c.name.toLocaleLowerCase() === value.name.trim().toLocaleLowerCase())) { showToast('This team is already listed.'); return; }
    update(prev => ({ ...prev, categories: id ? prev.categories.map(c => c.id === id ? { ...c, ...value, name: value.name.trim() } : c) : [...prev.categories, { id: newId(), ...value, name: value.name.trim(), active: true }] }));
    showToast(id ? 'Team updated.' : 'New team added.'); closePanel();
  };
  const toggleCategory = (category: Category) => {
    update(prev => ({ ...prev, categories: prev.categories.map(c => c.id === category.id ? { ...c, active: !c.active } : c) }));
    showToast(category.active ? 'Team hidden from new entries.' : 'Team restored.');
  };

  const downloadBackup = () => {
    const url = URL.createObjectURL(makeBackup(data));
    const a = document.createElement('a');
    a.href = url; a.download = `site-diary-backup-${day}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup downloaded. Keep it somewhere safe!');
  };
  const uploadBackup = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error('Choose a backup smaller than 8 MB.');
      const incoming = validateDiary(JSON.parse(await file.text()));
      if (!window.confirm('Replace all current Site Diary data with this backup? This cannot be undone.')) return;
      setData({ ...incoming, updatedAt: new Date().toISOString() });
      showToast('Your backup has been restored!');
      setPanel(null);
    } catch (err) { showToast(err instanceof Error ? err.message : 'Could not read that file.'); }
    finally { if (uploadRef.current) uploadRef.current.value = ''; }
  };
  const signIn = async () => {
    if (!supabase || !authEmail.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) showToast(error.message); else setLoginSent(true);
  };
  const resolveCloud = async (option: 'cloud' | 'device') => {
    if (!supabase || !cloudUser) return;
    if (option === 'cloud' && remote) { setData(remote); setCloudMode('ready'); setCloudEnabled(true); showToast('Cloud data loaded onto this phone.'); return; }
    setCloudMode('loading');
    const { error } = await supabase.from('site_diary_data').upsert({ user_id: cloudUser.id, payload: currentDataRef.current }, { onConflict: 'user_id' });
    if (error) { setCloudError(error.message); setCloudMode('error'); }
    else { setCloudMode('ready'); setCloudEnabled(true); showToast('This phone is now backed up to the cloud.'); }
  };

  const status = useMemo(() => cloudMode === 'ready' ? (cloudSaving ? 'Syncing…' : (cloudError ? 'Cloud sync error' : 'Cloud backup on')) : 'Saved on this device', [cloudMode, cloudSaving, cloudError]);

  const sitePanel = panel?.type === 'site' ? panel : null;
  const reportPanel = panel?.type === 'report' ? panel : null;
  const editorSite = sitePanel ? data.sites.find(s => s.id === sitePanel.siteId) : undefined;
  const editorEntry = sitePanel ? getEntry(sitePanel.siteId, sitePanel.date) : undefined;
  const historyDays = reportedDates(data).filter(d => friendlyDate(d).toLowerCase().includes(historySearch.toLowerCase()) || d.includes(historySearch));
  const unusedStarterSites = starterSites.filter(name => !activeSites.some(s => s.name.toLocaleLowerCase() === name.toLocaleLowerCase()));

  return <div className="desktop-shell">
    <div className="desktop-decoration" aria-hidden="true"><div className="desktop-brand">🏡 Site Diary</div><h2>A happier way<br/>to count the team.</h2><p>Little daily updates, beautifully organized.</p><img src="/illustrations/city.svg" alt=""/><div className="desktop-note">Made for real work. Designed for easy days. ✨</div></div>
    <div className="app-shell">
      {sitePanel && editorSite && editorEntry ? (
        <>
          <header className="sub-header"><IconButton label="Back" onClick={closePanel}><ArrowLeft size={24}/></IconButton><span>Daily Site Entry</span><div className="header-spacer"/></header>
          <main className="screen scroll-screen entry-screen">
            <div className="entry-title"><div><span className="eyebrow">{dateLabel(sitePanel.date)} · Team Count</span><h1>{editorSite.name}</h1>{editorSite.location && <p className="muted small">{editorSite.location}</p>}</div><div className="entry-house"><img src="/illustrations/city.svg" alt=""/></div></div>
            <div className="instructions"><div className="instruction-emoji">👷</div><div><strong>Who's working here?</strong><p>Enter fresh numbers for today. Leave unused teams blank.</p></div></div>
            <div className="worker-card">
              {data.categories.filter(cat => cat.active || Object.prototype.hasOwnProperty.call(editorEntry.counts, cat.id)).map((category) => {
                const count = editorEntry.counts[category.id];
                return <div className="worker-row" key={category.id}>
                  <div className={`team-icon color-${category.color}`}><TeamGlyph kind={category.icon}/></div>
                  <div className="worker-name" title={category.name}>{category.name}</div>
                  <div className="stepper">
                    <button type="button" aria-label={`Remove one ${category.name} worker`} disabled={count === undefined || count === 0} onClick={() => updateEntry(editorSite.id, sitePanel.date, prev => ({ ...prev, counts: { ...prev.counts, [category.id]: Math.max(0, (prev.counts[category.id] || 0) - 1) } }))}><Minus size={20}/></button>
                    <input aria-label={`${category.name} workers`} type="number" inputMode="numeric" min="0" max="99999" placeholder="–" value={count === undefined ? '' : count} onChange={e => updateEntry(editorSite.id, sitePanel.date, prev => {
                      const counts = { ...prev.counts };
                      if (e.target.value === '') delete counts[category.id];
                      else if (/^\d+$/.test(e.target.value)) counts[category.id] = Math.min(99999, Number(e.target.value));
                      return { ...prev, counts };
                    })}/>
                    <button type="button" className="stepper-plus" aria-label={`Add one ${category.name} worker`} onClick={() => updateEntry(editorSite.id, sitePanel.date, prev => ({ ...prev, counts: { ...prev.counts, [category.id]: Math.min(99999, (prev.counts[category.id] || 0) + 1) } }))}><Plus size={21}/></button>
                  </div>
                </div>;
              })}
              {data.categories.filter(c => c.active).length === 0 && <p className="muted">No teams set up. Add a team in Settings.</p>}
              <button className="add-team-inline" type="button" onClick={() => openCategoryFromEntry(editorSite.id, sitePanel.date)}><Plus size={18}/> Add another team or contractor</button>
            </div>
            <section className="remarks-card"><div className="remarks-head"><MessageCircle size={21}/><strong>Any remarks?</strong><span>Optional</span></div><textarea maxLength={3000} rows={3} value={editorEntry.remarks} placeholder="e.g. Material not arrived, only 2 painters came…" onChange={e => updateEntry(editorSite.id, sitePanel.date, prev => ({ ...prev, remarks: e.target.value }))}/><div className="remarks-help">💡 You can use your keyboard's microphone to speak instead of typing.</div></section>
            <div className="entry-summary"><div><span>Total at this site</span><strong>{entryTotal(editorEntry)} workers</strong></div><div className="entry-summary-icon"><Users size={26}/></div></div>
            {editorEntry.completed && <div className="notice success"><CheckCircle2 size={19}/> Saved as complete. Any edits need to be confirmed again.</div>}
            <button type="button" className="zero-link" onClick={() => { if (entryTotal(editorEntry) > 0 && !window.confirm('Replace these worker numbers with zero for this site?')) return; markComplete(editorSite.id, sitePanel.date, true); }}>No workers at this site today</button>
          </main>
          <div className="bottom-action"><button className="primary-button" type="button" disabled={entryTotal(editorEntry) <= 0} onClick={() => markComplete(editorSite.id, sitePanel.date)}><CheckCircle2 size={23}/> {entryTotal(editorEntry) > 0 ? `Finish site · ${entryTotal(editorEntry)} workers` : 'Enter workers to finish'}</button></div>
        </>
      ) : reportPanel ? (
        <ReportScreen date={reportPanel.date} data={data} day={day} onBack={closePanel} onEdit={(siteId) => { setReturnToReport(reportPanel.date); setPanel({ type: 'site', siteId, date: reportPanel.date }); }} onToast={showToast}/>
      ) : (
        <>
          <header className="main-header">
            <div className="brand"><div className="brand-icon"><img src="/icons/app-icon.svg" alt=""/></div><div><h1>Site Diary</h1><span>Daily manpower made easy</span></div></div>
            <IconButton label="Settings and backup" onClick={() => setPage('settings')}><Settings2 size={23}/></IconButton>
          </header>
          <main className="screen tab-screen" key={page}>
            {page === 'today' && <>
              <div className="today-hero">
                <div className="date-pill"><CalendarDays size={16}/>{friendlyDate(day)}</div>
                <div className="hero-body"><div className="hero-copy"><span className="hero-sun"><Sun size={19}/> Hello there!</span><h2>Let's count<br/>today's team.</h2><p>One site at a time. You've got this!</p></div><img className="hero-worker" src="/illustrations/worker.svg" alt="Cheerful construction worker holding a clipboard"/></div>
              </div>
              {activeSites.length > 0 && <div className="progress-card"><div className="progress-heading"><span><Sparkles size={16}/> Today's progress</span><strong>{completeCount} of {activeSites.length} sites done</strong></div><div className="progress-bar" aria-label={`${completionPercent}% completed`} role="progressbar" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${completionPercent}%` }}/></div><div className="stats-line"><span><Users size={17}/> {todayTotal} workers recorded</span>{isReadyToShare && <span className="all-done"><BadgeCheck size={17}/> All done!</span>}</div></div>}
              <div className="section-row"><div><h2>My Sites <span className="section-count">{activeSites.length}</span></h2><p>{activeSites.length ? "Tap a site to enter today's counts" : 'Choose the sites you want to track'}</p></div><IconButton label="Add new site" className="header-add" onClick={() => setPanel({ type: 'addSite' })}><Plus size={24}/></IconButton></div>
              {activeSites.length === 0 ? <StarterSitesPicker onConfirm={addStarterSites}/> : <>
                <div className="site-list">
                  {activeSites.map((site, i) => {
                    const entry = data.days[day]?.[site.id];
                    const complete = !!entry?.completed;
                    return <button type="button" className={`site-card ${complete ? 'is-complete' : ''}`} onClick={() => setPanel({ type: 'site', siteId: site.id, date: day })} key={site.id}>
                      <div className={`site-avatar avatar-${i % 5}`}><House size={27} strokeWidth={2.3}/></div><div className="site-info"><strong>{site.name}</strong><span>{complete ? (entry.noWorkers ? 'No workers today' : `${entryTotal(entry)} workers · ${Object.entries(entry.counts).filter(([, n]) => n > 0).length} teams`) : entry && Object.values(entry.counts).some(n => n > 0) ? 'Draft · Tap to finish' : 'Not entered yet'}</span></div><div className={complete ? 'site-check done' : 'site-check pending'}>{complete ? <Check size={18}/> : <ChevronRight size={21}/>}</div>
                    </button>;
                  })}
                </div>
                <button type="button" className="manage-sites-inline" onClick={() => setPage('sites')}><Building2 size={16}/> Add or remove sites</button>
              </>}
              {activeSites.length > 0 && <div className="share-card"><div className="share-card-copy"><strong>{isReadyToShare ? 'All sites are ready! 🎉' : 'Ready to send your report?'}</strong><span>{isReadyToShare ? 'Your daily report is prepared.' : `${activeSites.length - completeCount} ${activeSites.length - completeCount === 1 ? 'site' : 'sites'} still to complete`}</span></div><button className="primary-button" type="button" disabled={!isReadyToShare} onClick={() => setPanel({ type: 'report', date: day })}><MessageCircle size={21}/> Review &amp; Share <ArrowRight size={18}/></button>{!isReadyToShare && <span className="share-tip">Finish every site (including zero-worker sites) to share.</span>}</div>}
              <div className="sync-footnote"><ShieldCheck size={15}/>{status}. <button type="button" onClick={() => setPage('settings')}>Backup options</button></div>
            </>}
            {page === 'history' && <>
              <div className="heading-with-art"><PageTitle subtitle="Find, correct or resend an old report.">Report History</PageTitle><div className="heading-emoji">📅</div></div>
              <div className="search-box"><Search size={18}/><input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search a date..." aria-label="Search report dates"/></div>
              {historyDays.length ? <div className="history-list">{historyDays.map((d, i) => {
                const entries = reportedSites(data, d);
                const sum = entries.reduce((acc, x) => acc + entryTotal(x.entry), 0);
                return <button className="history-card" type="button" key={d} onClick={() => setPanel({ type: 'report', date: d })}><div className={`history-icon history-icon-${i % 4}`}><CalendarDays size={22}/></div><div><strong>{friendlyDate(d, true)}</strong><span>{entries.length} sites · {sum} workers</span></div><ChevronRight size={21}/></button>;
              })}</div> : <div className="empty-block history-empty"><div className="big-emoji">🗓️</div><h3>{historySearch ? 'No matching dates' : 'Your reports will appear here'}</h3><p>{historySearch ? 'Try another date or clear your search.' : 'Once you finish your first site, its report is saved here automatically.'}</p></div>}
            </>}
            {page === 'sites' && <>
              <div className="heading-with-art"><PageTitle subtitle="Add, rename, or remove sites from your daily list.">My Sites</PageTitle><div className="heading-emoji">🏘️</div></div>
              <div className="segmented"><button type="button" className={!archivedTab ? 'selected' : ''} onClick={() => setArchivedTab(false)}>Active <span>{activeSites.length}</span></button><button type="button" className={archivedTab ? 'selected' : ''} onClick={() => setArchivedTab(true)}>Removed / Finished <span>{data.sites.filter(s => !s.active).length}</span></button></div>
              {!archivedTab && activeSites.length === 0 ? <StarterSitesPicker onConfirm={addStarterSites}/> : data.sites.filter(s => s.active !== archivedTab).length ? <div className="manage-list">{data.sites.filter(s => s.active !== archivedTab).map((site, index) => <div className="manage-card" key={site.id}><div className={`site-avatar avatar-${index % 5}`}><Building2 size={23}/></div><div className="manage-info"><strong>{site.name}</strong><span>{site.location || (site.active ? 'Active project' : 'Removed from daily list')}</span></div>{site.active ? <div className="manage-actions"><button type="button" className="mini-action" aria-label={`Edit ${site.name}`} onClick={() => setPanel({ type: 'editSite', siteId: site.id })}>Edit</button><button type="button" className="mini-action danger-mini" aria-label={`Remove ${site.name}`} onClick={() => archiveSite(site)}>Remove</button></div> : <button type="button" className="mini-action restore-mini" aria-label={`Add back ${site.name}`} onClick={() => restoreSite(site)}><RotateCcw size={14}/> Add back</button>}</div>)}</div> : <div className="empty-block compact-empty"><div className="big-emoji">{archivedTab ? '📦' : '🏡'}</div><h3>{archivedTab ? 'No removed sites' : 'No active sites yet'}</h3><p>{archivedTab ? 'Sites you remove from your daily list stay here so old reports remain safe.' : 'Add a site to start counting workers.'}</p></div>}
              {!archivedTab && activeSites.length > 0 && unusedStarterSites.length > 0 && <div className="quick-add-box">
                <div className="quick-add-head"><strong>Quick-add from your sites</strong><span>Tap any site to add it to Today</span></div>
                <div className="quick-add-chips">{unusedStarterSites.map(name => <button type="button" key={name} className="quick-chip" onClick={() => addSite(name, '')}><Plus size={15}/> {name}</button>)}</div>
              </div>}
              <button type="button" className="yellow-button full-width" onClick={() => setPanel({ type: 'addSite' })}><Plus size={22}/> Add New Site</button>
              <div className="helper-box"><Info size={18}/><p>You can add or remove sites anytime. Removing a site hides it from Today while keeping its past reports safe.</p></div>
              <button type="button" className="text-settings-link" onClick={() => setPage('settings')}><Settings2 size={17}/> Manage departments &amp; contractors <ChevronRight size={18}/></button>
            </>}
            {page === 'settings' && <>
              <div className="heading-with-art"><PageTitle subtitle="A few useful settings for your diary.">Settings</PageTitle><div className="heading-emoji">⚙️</div></div>
              <h2 className="settings-section-title">Teams &amp; Contractors</h2>
              <p className="settings-hint">Choose the names that appear at every site. Ramu or another contractor can be a team too.</p>
              <div className="settings-card">{data.categories.map(c => <div className="settings-row" key={c.id}><div className={`team-icon color-${c.color}`}><TeamGlyph kind={c.icon} size={19}/></div><span className={!c.active ? 'inactive-label' : ''}>{c.name}</span><button className="mini-action" type="button" aria-label={`Edit ${c.name}`} onClick={() => setPanel({ type: 'editCategory', categoryId: c.id })}>Edit</button><button type="button" className="toggle-icon" aria-label={`${c.active ? 'Hide' : 'Show'} ${c.name}`} onClick={() => toggleCategory(c)}>{c.active ? <CheckCircle2 size={21} color="#20a876"/> : <Plus size={21}/>}</button></div>)}</div>
              <button className="outline-button full-width" type="button" onClick={() => setPanel({ type: 'addCategory' })}><Plus size={19}/> Add Department or Contractor</button>
              <h2 className="settings-section-title">Keep Your Data Safe</h2>
              <div className="settings-card backup-area"><div className="backup-intro"><div className="backup-glyph"><ShieldCheck size={24}/></div><div><strong>Backup your notebook</strong><p>Save a copy you can restore if you change your phone.</p></div></div>
                <div className="backup-buttons"><button type="button" className="outline-button" onClick={downloadBackup}><Download size={18}/> Download</button><button type="button" className="outline-button" onClick={() => uploadRef.current?.click()}><Upload size={18}/> Restore</button></div>
                <input ref={uploadRef} type="file" accept=".json,application/json" hidden onChange={e => void uploadBackup(e.target.files?.[0])}/>
              </div>
              <h2 className="settings-section-title">Cloud Backup <span className="optional">Optional</span></h2>
              <div className="settings-card cloud-area">
                {!cloudConfigured ? <><div className="backup-intro"><div className="backup-glyph cloud"><CloudOff size={24}/></div><div><strong>Saved on this device</strong><p>Everything works without an account. To protect against lost or changed phones, download backups regularly.</p></div></div><div className="micro-note">The app owner can enable private cloud backup during Vercel setup. See README.</div></> : cloudMode === 'signed-out' ? <><div className="backup-intro"><div className="backup-glyph cloud"><Cloud size={24}/></div><div><strong>Sign in to sync your notebook</strong><p>Get an email sign-in link. No password to remember.</p></div></div><form onSubmit={e => { e.preventDefault(); void signIn(); }} className="cloud-form"><label htmlFor="cloud-email">Your email address</label><input id="cloud-email" type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com"/><button type="submit" className="primary-button">Email me a sign-in link</button>{loginSent && <p className="small green-text">Link sent! Open the email on this phone to sign in.</p>}</form></> : cloudMode === 'loading' ? <div className="backup-intro"><Cloud size={24}/><div><strong>Connecting securely…</strong><p>Checking for an existing notebook.</p></div></div> : cloudMode === 'choose' ? <><strong>Existing cloud diary found</strong><p className="settings-hint">Choose which notebook to keep. This replaces the other copy, so download a backup first if you're unsure.</p><div className="choice-buttons"><button className="outline-button full-width" type="button" onClick={() => void resolveCloud('cloud')}><Cloud size={19}/> Use my cloud notebook</button><button className="outline-button full-width" type="button" onClick={() => void resolveCloud('device')}><Download size={19}/> Use this phone's notebook</button></div></> : cloudMode === 'error' ? <><strong>Could not connect</strong><p className="error-text">{cloudError || 'Please check cloud setup and try again.'}</p><button className="outline-button" type="button" onClick={() => window.location.reload()}>Try again</button></> : <><div className="backup-intro"><div className="backup-glyph success-bg"><Cloud size={24}/></div><div><strong>Cloud backup is on <Check size={16}/></strong><p>{cloudSaving ? 'Saving your latest changes…' : cloudError || `Connected as ${cloudUser?.email || 'your email'}`}</p></div></div><button className="link-button" type="button" onClick={async () => { await supabase?.auth.signOut(); showToast('Signed out. Device data stays here.'); }}>Sign out of cloud</button></>}
              </div>
              {storageError && <div className="notice warn"><Info size={19}/> Your browser cannot save data. Check private browsing or available storage, and export a backup.</div>}
              <div className="footer-signoff"><Heart size={16}/> Made with care for everyday work <span>Site Diary v1.0</span></div>
            </>}
          </main>
          <nav className="tab-bar" aria-label="Main navigation"><button className={page === 'today' ? 'active' : ''} type="button" onClick={() => setPage('today')}><House size={23}/><span>Today</span></button><button className={page === 'history' ? 'active' : ''} type="button" onClick={() => setPage('history')}><History size={23}/><span>History</span></button><button className={page === 'sites' ? 'active' : ''} type="button" onClick={() => setPage('sites')}><Users size={23}/><span>My Sites</span></button></nav>
        </>
      )}

      {(panel?.type === 'addSite' || panel?.type === 'editSite') && <SiteForm key={panel.type === 'editSite' ? panel.siteId : 'new'} site={panel.type === 'editSite' ? data.sites.find(s => s.id === panel.siteId) : undefined} onClose={closePanel} onSubmit={(name, location) => panel.type === 'addSite' ? addSite(name, location) : (editSite(panel.siteId, name, location), true)} onArchive={panel.type === 'editSite' ? () => { const s = data.sites.find(s => s.id === panel.siteId); if (s) archiveSite(s); } : undefined}/>}
      {(panel?.type === 'addCategory' || panel?.type === 'editCategory') && <CategoryForm key={panel.type === 'editCategory' ? panel.categoryId : 'new'} category={panel.type === 'editCategory' ? data.categories.find(c => c.id === panel.categoryId) : undefined} onSubmit={(value) => saveCategory(value, panel.type === 'editCategory' ? panel.categoryId : undefined)} onClose={closePanel}/>}
      {toast && <div role="status" className="toast"><CheckCircle2 size={19}/>{toast}</div>}
    </div>
  </div>;
}

function StarterSitesPicker({ onConfirm }: { onConfirm: (names: string[]) => void }) {
  const [options, setOptions] = useState<string[]>(() => [...starterSites]);
  const [selected, setSelected] = useState<string[]>(() => [...starterSites]);
  const [customName, setCustomName] = useState('');
  const toggleSite = (name: string) => {
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };
  const addCustom = () => {
    const clean = customName.trim();
    if (!clean) return;
    if (!options.some(n => n.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
      setOptions(prev => [...prev, clean]);
    }
    if (!selected.some(n => n.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
      setSelected(prev => [...prev, clean]);
    }
    setCustomName('');
  };
  const chosenInOrder = options.filter(name => selected.includes(name));
  return <section className="starter-card" aria-label="Choose your sites">
    <div className="starter-header">
      <div className="starter-badge">🏡 Ready to start</div>
      <h3>Continue with your sites</h3>
      <p>Tap any site to remove or keep it, or add a new site below.</p>
    </div>
    <div className="starter-list">
      {options.map((name, i) => {
        const isPicked = selected.includes(name);
        return <button type="button" key={name} className={`starter-item ${isPicked ? 'is-picked' : 'is-unpicked'}`} aria-pressed={isPicked} onClick={() => toggleSite(name)}>
          <span className="starter-num">{i + 1}</span>
          <strong className="starter-name">{name}</strong>
          <span className={`starter-check ${isPicked ? 'checked' : ''}`}>{isPicked ? <Check size={17}/> : <Plus size={17}/>}</span>
        </button>;
      })}
    </div>
    <div className="starter-add-row">
      <input type="text" maxLength={120} value={customName} onChange={e => setCustomName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} placeholder="Add another site name…" aria-label="Add another site name"/>
      <button type="button" className="outline-button" disabled={!customName.trim()} onClick={addCustom}><Plus size={18}/> Add</button>
    </div>
    <button type="button" className="primary-button full-width" disabled={chosenInOrder.length === 0} onClick={() => onConfirm(chosenInOrder)}>
      <CheckCircle2 size={21}/> {chosenInOrder.length > 0 ? `Continue with ${chosenInOrder.length} ${chosenInOrder.length === 1 ? 'site' : 'sites'}` : 'Select at least 1 site'}
    </button>
  </section>;
}

function SiteForm({ site, onClose, onSubmit, onArchive }: { site?: Site; onClose: () => void; onSubmit: (name: string, location: string) => boolean; onArchive?: () => void }) {
  const [name, setName] = useState(site?.name || '');
  const [location, setLocation] = useState(site?.location || '');
  return <Modal title={site ? 'Edit Site' : 'Add a New Site'} onClose={onClose}><form className="form-stack" onSubmit={e => { e.preventDefault(); onSubmit(name, location); }}><div className="form-illustration">🏡 <span>{site ? 'Make an update' : 'A new project!'}</span></div><label htmlFor="site-name">Site name <span className="required">*</span></label><input id="site-name" autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sethi Ji"/><label htmlFor="site-location">Location / Address <span className="optional">Optional</span></label><input id="site-location" maxLength={200} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Civil Lines"/><p className="form-hint">Use a familiar name so the site is easy to recognize.</p><button className="primary-button" type="submit"><Check size={20}/> {site ? 'Save Changes' : 'Add Site'}</button>{site && onArchive && <button className="archive-button" type="button" onClick={onArchive}><Archive size={17}/> Remove from active sites</button>}</form></Modal>;
}
function CategoryForm({ category, onClose, onSubmit }: { category?: Category; onClose: () => void; onSubmit: (value: { name: string; icon: CategoryIcon; color: string }) => void }) {
  const [name, setName] = useState(category?.name || '');
  const [icon, setIcon] = useState<CategoryIcon>(category?.icon || 'worker');
  const [color, setColor] = useState(category?.color || 'mint');
  return <Modal title={category ? 'Edit Team' : 'Add a Team or Contractor'} onClose={onClose}><form className="form-stack" onSubmit={e => { e.preventDefault(); onSubmit({ name, icon, color }); }}><label htmlFor="team-name">Team name <span className="required">*</span></label><input id="team-name" autoFocus required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Plumber or Ramu"/><label>Choose an icon</label><div className="icon-picker">{colorOptions.map(it => <button type="button" className={icon === it.value ? 'picked' : ''} key={it.value} aria-label={it.name} title={it.name} onClick={() => setIcon(it.value)}><TeamGlyph kind={it.value}/></button>)}</div><label>Choose a color</label><div className="color-picker">{pickColors.map(c => <button type="button" key={c} title={c} aria-label={`Color ${c}`} aria-pressed={color === c} className={`color-${c} ${color === c ? 'picked' : ''}`} onClick={() => setColor(c)}>{color === c && <Check size={18}/>}</button>)}</div><button className="primary-button" type="submit"><Check size={19}/> {category ? 'Save Team' : 'Add Team'}</button></form></Modal>;
}
function ReportScreen({ date, day, data, onBack, onEdit, onToast }: { date: string; day: string; data: DiaryData; onBack: () => void; onEdit: (siteId: string) => void; onToast: (text: string) => void }) {
  const entries = reportedSites(data, date);
  const report = useMemo(() => formatReport(data, date), [data, date]);
  const total = entries.reduce((sum, x) => sum + entryTotal(x.entry), 0);
  const current = date === day;
  const incomplete = current && data.sites.some(s => s.active && !data.days[date]?.[s.id]?.completed);
  const copy = async () => { try { await navigator.clipboard.writeText(report); onToast('Report copied!'); } catch { onToast('Copy not supported here. Try WhatsApp instead.'); } };
  return <><header className="sub-header"><IconButton label="Back" onClick={onBack}><ArrowLeft size={24}/></IconButton><span>Review Report</span><div className="header-spacer"/></header>
    <main className="screen scroll-screen report-screen">
      <div className="report-hero"><div className="date-pill"><CalendarDays size={16}/>{friendlyDate(date)}</div><div className="report-hero-summary"><div className="report-stat"><div className="report-stat-icon green"><Check size={23}/></div><strong>{entries.length}</strong><span>Sites completed</span></div><div className="report-stat"><div className="report-stat-icon orange"><Users size={23}/></div><strong>{total}</strong><span>Total workers</span></div></div></div>
      {incomplete && <div className="notice warn"><Info size={19}/> Some sites are not finished. Complete them before sharing today's report.</div>}
      <div className="section-row report-section"><div><h2>Site Summary</h2><p>Check everything before sending</p></div><FileText size={23} color="#94a1ad"/></div>
      <div className="report-sites">{entries.map(({ site, entry }, i) => <button type="button" className="report-site" key={site.id} onClick={() => onEdit(site.id)}><div className={`report-index ${i % 2 === 0 ? 'green' : 'orange'}`}>{i + 1}</div><div className="report-site-info"><strong>{entry.siteName || site.name}</strong><span>{entry.noWorkers ? 'No workers today' : Object.entries(entry.counts).filter(([, n]) => n > 0).map(([cid, n]) => `${entry.categoryNames?.[cid] || data.categories.find(c => c.id === cid)?.name || 'Team'} ${n}`).join(' · ') || 'No workers today'}</span><b>Total: {entryTotal(entry)}</b>{entry.remarks.trim() && <em>📝 {entry.remarks}</em>}</div><ChevronRight size={20}/></button>)}</div>
      {!entries.length && <div className="empty-block compact-empty"><div className="big-emoji">📋</div><h3>No completed sites yet</h3><p>Finish a site and its information will appear here.</p></div>}
      <div className="message-preview"><div className="preview-title"><MessageCircle size={18}/> WhatsApp message preview</div><div className="chat-bubble">{report.split('\n').map((line, i) => <div key={i} className={`chat-line ${line.startsWith('*') ? 'chat-bold' : ''}`}>{line.replaceAll('*', '') || '\u00a0'}</div>)}</div></div>
      <p className="report-helper">WhatsApp opens with your report prepared. Choose the head office chat and tap Send.</p>
    </main>
    <div className="bottom-action report-actions"><button className="outline-button" type="button" disabled={incomplete || entries.length === 0} onClick={() => void copy()}><Copy size={20}/> Copy</button><button className="primary-button whatsapp-button" type="button" disabled={incomplete || entries.length === 0} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank', 'noopener,noreferrer')}><MessageCircle size={21}/> Send on WhatsApp</button></div>
  </>;
}
