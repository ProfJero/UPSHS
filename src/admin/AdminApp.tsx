import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  GoogleAuthProvider, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from 'firebase/auth';
import { COLLECTIONS, INBOXES, SETTINGS_FIELDS, ROLES, ROLE_LABELS, can, findCollection, type CollectionDef, type Field, type Role } from '../../shared/collections';
import { api, ApiError, auth, firebaseConfigured, setApiUser, thumb, API_URL } from './api';
import { FieldInput, Icon } from './fields';

type Doc = Record<string, unknown> & { id: string };
interface Me { user: { email: string; name?: string; picture?: string }; role: Role; counts: Record<string, number>; services: { cloudinary: boolean; rebuildHook: boolean } }
interface Toast { id: number; kind: 'ok' | 'err'; text: string }

// ---------------- routing ----------------
function useHashRoute(): [string[], (p: string) => void] {
  const parse = () => (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
  const [route, setRoute] = useState<string[]>(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return [route, (p) => { location.hash = `/${p}`; }];
}

const fmt = (v: unknown, withTime = true) => {
  if (typeof v !== 'string' || !v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
};

function cell(f: Field, v: unknown) {
  if (v === null || v === undefined || v === '') return <span className="muted">—</span>;
  if (f.type === 'datetime' || f.type === 'date') return fmt(v, f.type === 'datetime');
  if (f.name === 'status') return <span className={`status status--${v}`}>{String(v).replace(/_/g, ' ')}</span>;
  if (f.type === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

// ---------------- root ----------------
export default function AdminApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<ApiError | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const loadMe = useCallback(async () => {
    setMeError(null);
    try { setMe(await api<Me>('/me?stats=1')); } catch (e) { setMe(null); setMeError(e as ApiError); }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth(), (u) => { setApiUser(u); setUser(u); if (u) loadMe(); else setMe(null); });
  }, [loadMe]);

  if (!firebaseConfigured) return <SetupNotice />;
  if (user === undefined) return <Splash />;
  if (!user) return <Login />;
  if (!me) return <AccessGate user={user} error={meError} retry={loadMe} />;

  return (
    <>
      <Shell me={me} refreshMe={loadMe} toast={toast} />
      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast toast--${t.kind}`}><Icon name={t.kind === 'ok' ? 'check-circle' : 'alert'} /> {t.text}</div>)}</div>
    </>
  );
}

function Splash() {
  return <div className="center-screen"><img src="/images/brand/crest.webp" alt="" className="splash-crest" /><span className="spinner" /></div>;
}

function SetupNotice() {
  return (
    <div className="center-screen">
      <div className="auth-card">
        <img src="/images/brand/crest.webp" alt="" width={64} />
        <h1>Staff portal setup needed</h1>
        <p>The Firebase web configuration has not been added to this deployment yet. Add <code>PUBLIC_FIREBASE_API_KEY</code>, <code>PUBLIC_FIREBASE_AUTH_DOMAIN</code>, <code>PUBLIC_FIREBASE_PROJECT_ID</code> and <code>PUBLIC_FIREBASE_APP_ID</code> as Cloudflare Pages environment variables, then redeploy.</p>
        <a className="a-btn" href="/">Back to website</a>
      </div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const friendly = (e: unknown) => {
    const code = (e as { code?: string }).code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Incorrect email or password.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
    if (code.includes('popup-closed')) return 'Sign-in window was closed.';
    return (e as Error).message;
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { await signInWithEmailAndPassword(auth(), email.trim(), password); } catch (err) { setMsg({ kind: 'err', text: friendly(err) }); } finally { setBusy(false); }
  };
  const google = async () => { setMsg(null); try { await signInWithPopup(auth(), new GoogleAuthProvider()); } catch (err) { setMsg({ kind: 'err', text: friendly(err) }); } };
  const reset = async () => {
    if (!email) { setMsg({ kind: 'err', text: 'Enter your email address first.' }); return; }
    try { await sendPasswordResetEmail(auth(), email.trim()); setMsg({ kind: 'ok', text: 'Password reset email sent. Check your inbox.' }); } catch (err) { setMsg({ kind: 'err', text: friendly(err) }); }
  };
  return (
    <div className="login">
      <aside className="login__art">
        <img src="/images/brand/crest-floreat.png" alt="UPSHS crest" />
        <p>“Service to the Community”</p>
      </aside>
      <main className="login__main">
        <form className="auth-card" onSubmit={submit}>
          <a href="/" className="auth-card__back"><Icon name="arrow-left" size={16} /> Website</a>
          <h1>Staff portal</h1>
          <p className="muted">Sign in to manage news, events, the gallery and more.</p>
          <label className="a-field"><span>Email</span><input className="a-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="a-field"><span>Password</span><input className="a-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {msg && <p className={`a-msg a-msg--${msg.kind}`}>{msg.text}</p>}
          <button className="a-btn a-btn--block" disabled={busy}>{busy ? <span className="spinner" /> : null} Sign in</button>
          <button type="button" className="a-btn a-btn--ghost a-btn--block" onClick={google}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
          <button type="button" className="link-btn" onClick={reset}>Forgot password?</button>
        </form>
      </main>
    </div>
  );
}

function AccessGate({ user, error, retry }: { user: User; error: ApiError | null; retry: () => void }) {
  const [sent, setSent] = useState(false);
  const unverified = error?.status === 403 && /verify/i.test(error.message);
  return (
    <div className="center-screen">
      <div className="auth-card">
        <img src="/images/brand/crest.webp" alt="" width={56} />
        {!error ? <span className="spinner" /> : (
          <>
            <h1>{unverified ? 'Verify your email' : error.status === 403 ? 'Access pending' : 'Cannot connect'}</h1>
            <p>{error.message}</p>
            <p className="muted">Signed in as <strong>{user.email}</strong></p>
            {unverified && !sent && <button className="a-btn" onClick={async () => { await sendEmailVerification(user); setSent(true); }}>Send verification email</button>}
            {sent && <p className="a-msg a-msg--ok">Verification email sent. Click the link, then press “Try again”.</p>}
            <div className="row">
              <button className="a-btn a-btn--ghost" onClick={async () => { await user.reload(); await user.getIdToken(true); retry(); }}>Try again</button>
              <button className="a-btn a-btn--ghost" onClick={() => signOut(auth())}>Sign out</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- shell ----------------
function Shell({ me, refreshMe, toast }: { me: Me; refreshMe: () => void; toast: (t: string, k?: 'ok' | 'err') => void }) {
  const [route, go] = useHashRoute();
  const [navOpen, setNavOpen] = useState(false);
  const [section, id] = route;
  useEffect(() => setNavOpen(false), [section, id]);
  const toggleTheme = () => {
    const d = document.documentElement;
    const next = d.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('upshs-mode', next); } catch { /* ignore */ }
    (window as Window & { __upshsApplyTheme?: () => void }).__upshsApplyTheme?.();
  };
  const rebuild = async () => {
    try { await api('/rebuild', { method: 'POST' }); toast('Publishing started — the website will update in about 1–2 minutes.'); }
    catch (e) { toast((e as Error).message, 'err'); }
  };

  let view;
  const col = section ? findCollection(section) : undefined;
  if (section === 'dashboard' || !section) view = <Dashboard me={me} go={go} />;
  else if (section === 'settings') view = <SettingsView me={me} toast={toast} />;
  else if (section === 'staff') view = <StaffView me={me} toast={toast} />;
  else if (section === 'activity') view = <ActivityView />;
  else if (col && id) view = <Editor def={col} id={id === 'new' ? null : id} me={me} go={go} toast={toast} onSaved={refreshMe} />;
  else if (col) view = <ListView def={col} me={me} go={go} />;
  else view = <p>Page not found.</p>;

  const NavLink = ({ to, icon, label, badge }: { to: string; icon: string; label: string; badge?: number }) => (
    <a href={`#/${to}`} className={`side__link${(section || 'dashboard') === to ? ' is-active' : ''}`}><Icon name={icon} /> <span>{label}</span>{badge ? <em>{badge}</em> : null}</a>
  );

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <aside className="side">
        <a href="#/dashboard" className="side__brand"><img src="/images/brand/crest.webp" alt="" /><span><strong>UPSHS</strong><small>Staff portal</small></span></a>
        <nav>
          <NavLink to="dashboard" icon="layout" label="Dashboard" />
          <p className="side__group">Content</p>
          {COLLECTIONS.map((c) => <NavLink key={c.key} to={c.key} icon={c.icon} label={c.label} />)}
          {can(me.role, 'inbox') && (<><p className="side__group">Inbox</p>{INBOXES.map((c) => <NavLink key={c.key} to={c.key} icon={c.icon} label={c.label} badge={c.key === 'messages' ? me.counts.newMessages : undefined} />)}</>)}
          {(can(me.role, 'settings') || can(me.role, 'staff')) && <p className="side__group">Administration</p>}
          {can(me.role, 'settings') && <NavLink to="settings" icon="settings" label="Site settings" />}
          {can(me.role, 'staff') && <NavLink to="staff" icon="users" label="Team & access" />}
          {can(me.role, 'settings') && <NavLink to="activity" icon="clock" label="Activity log" />}
        </nav>
      </aside>
      <div className="shell__main">
        <header className="topbar">
          <button className="icon-only menu" onClick={() => setNavOpen(!navOpen)} aria-label="Menu"><Icon name="menu" /></button>
          <div className="topbar__spacer" />
          {can(me.role, 'publish') && <button className="a-btn a-btn--sm" onClick={rebuild} title="Rebuild the public website with the latest published content"><Icon name="refresh" size={16} /> Publish site</button>}
          <a className="a-btn a-btn--ghost a-btn--sm" href="/" target="_blank" rel="noreferrer"><Icon name="eye" size={16} /> View site</a>
          <button className="icon-only" onClick={toggleTheme} aria-label="Toggle dark mode"><Icon name="moon" /></button>
          <div className="me">
            {me.user.picture ? <img src={me.user.picture} alt="" /> : <span className="me__avatar">{(me.user.name || me.user.email)[0]?.toUpperCase()}</span>}
            <span className="me__text"><strong>{me.user.name || me.user.email}</strong><small>{ROLE_LABELS[me.role]}</small></span>
            <button className="icon-only" onClick={() => signOut(auth())} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
          </div>
        </header>
        <main className="content" key={route.join('/')}>{view}</main>
      </div>
      <div className="scrim" onClick={() => setNavOpen(false)} />
    </div>
  );
}

// ---------------- dashboard ----------------
function Dashboard({ me, go }: { me: Me; go: (p: string) => void }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="page">
      <div className="page__head">
        <div><h1>{greet}, {(me.user.name || me.user.email).split(/[ @]/)[0]}.</h1><p className="muted">Here’s what’s on the UPSHS website.</p></div>
      </div>
      {(!me.services.cloudinary || !me.services.rebuildHook) && (
        <div className="callout">
          <Icon name="info" />
          <div>
            {!me.services.cloudinary && <p><strong>Cloudinary is not configured</strong> on the API, so image and document uploads are disabled.</p>}
            {!me.services.rebuildHook && <p><strong>No rebuild hook is configured</strong>, so published changes reach the website on the next deployment.</p>}
          </div>
        </div>
      )}
      <div className="tiles">
        {COLLECTIONS.map((c) => (
          <button key={c.key} className="tile" onClick={() => go(c.key)}>
            <span className="tile__icon"><Icon name={c.icon} size={22} /></span>
            <strong>{me.counts[c.key] ?? '—'}</strong>
            <span>{c.label}</span>
          </button>
        ))}
        {can(me.role, 'inbox') && INBOXES.map((c) => (
          <button key={c.key} className="tile tile--inbox" onClick={() => go(c.key)}>
            <span className="tile__icon"><Icon name={c.icon} size={22} /></span>
            <strong>{me.counts[c.key] ?? '—'}</strong>
            <span>{c.label}{c.key === 'messages' && me.counts.newMessages ? ` · ${me.counts.newMessages} new` : ''}</span>
          </button>
        ))}
      </div>
      <h2 className="section-title">Quick actions</h2>
      <div className="quick">
        <button className="quick__btn" onClick={() => go('news/new')}><Icon name="newspaper" /> Write a story</button>
        <button className="quick__btn" onClick={() => go('announcements/new')}><Icon name="megaphone" /> Post a notice</button>
        <button className="quick__btn" onClick={() => go('events/new')}><Icon name="calendar-plus" /> Add an event</button>
        <button className="quick__btn" onClick={() => go('albums/new')}><Icon name="images" /> Create an album</button>
        <button className="quick__btn" onClick={() => go('downloads/new')}><Icon name="upload" /> Upload a document</button>
      </div>
      <div className="tips">
        <h2 className="section-title">Good practice</h2>
        <ul>
          <li>Only publish photos of students that have been approved for public display.</li>
          <li>Write a short summary and add alt text to images — it helps people using screen readers and improves Google results.</li>
          <li>{me.role === 'media' ? 'Your posts are sent to an editor for review before they go live.' : 'Media team submissions marked “review” are waiting for your approval.'}</li>
        </ul>
      </div>
    </div>
  );
}

// ---------------- list ----------------
function ListView({ def, me, go }: { def: CollectionDef; me: Me; go: (p: string) => void }) {
  const [items, setItems] = useState<Doc[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const statusField = def.fields.find((f) => f.name === 'status');
  const cols = def.fields.filter((f) => f.list);
  const imageField = def.fields.find((f) => f.type === 'image' || f.type === 'gallery');

  useEffect(() => { api<{ items: Doc[] }>(`/c/${def.key}`).then((r) => setItems(r.items)).catch((e) => setError(e.message)); }, [def.key]);
  const filtered = useMemo(() => (items || []).filter((it) =>
    (status === 'all' || it.status === status) && (!q || JSON.stringify(it).toLowerCase().includes(q.toLowerCase()))), [items, q, status]);
  const firstImage = (it: Doc) => { const v = imageField ? it[imageField.name] : null; const img = Array.isArray(v) ? v[0] : v; return (img as { url?: string } | null)?.url; };
  const exportCsv = () => {
    const keys = def.fields.map((f) => f.name);
    const rows = [keys.join(','), ...filtered.map((it) => keys.map((k) => `"${String(it[k] ?? '').replace(/"/g, '""')}"`).join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = `upshs-${def.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="page">
      <div className="page__head">
        <div><h1>{def.label}</h1><p className="muted">{def.description}</p></div>
        <div className="row">
          {!def.publishable && <button className="a-btn a-btn--ghost" onClick={exportCsv}><Icon name="download" size={16} /> Export CSV</button>}
          {def.publishable && <button className="a-btn" onClick={() => go(`${def.key}/new`)}><Icon name="plus" size={16} /> New {def.singular.toLowerCase()}</button>}
        </div>
      </div>
      <div className="toolbar">
        <label className="search"><Icon name="search" size={16} /><input placeholder={`Search ${def.label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {statusField && (
          <div className="pills">
            {['all', ...(statusField.options || [])].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s.replace(/_/g, ' ')}{s !== 'all' && items ? ` (${items.filter((i) => i.status === s).length})` : ''}</button>)}
          </div>
        )}
      </div>
      {error ? <p className="a-msg a-msg--err">{error}</p> : !items ? <div className="skeleton-list">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div> : filtered.length === 0 ? (
        <div className="empty-a"><Icon name={def.icon} size={32} /><h2>Nothing here yet</h2>{def.publishable && <button className="a-btn" onClick={() => go(`${def.key}/new`)}>Create the first {def.singular.toLowerCase()}</button>}</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{imageField && <th aria-label="Image" />}{cols.map((c) => <th key={c.name}>{c.label}</th>)}<th aria-label="Open" /></tr></thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} onClick={() => go(`${def.key}/${it.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`${def.key}/${it.id}`)}>
                  {imageField && <td className="td-thumb">{firstImage(it) ? <img src={thumb(firstImage(it)!, 96, 64)} alt="" /> : <span className="thumb-ph"><Icon name={def.icon} size={16} /></span>}</td>}
                  {cols.map((c, i) => <td key={c.name} className={i === 0 ? 'td-title' : ''}>{cell(c, it[c.name])}</td>)}
                  <td className="td-go"><Icon name="chevron-right" size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {def.publishable && me.role === 'media' && <p className="muted small">As a media team member you can create drafts and submit them for review. An editor will publish them.</p>}
    </div>
  );
}

// ---------------- editor ----------------
function Editor({ def, id, me, go, toast, onSaved }: { def: CollectionDef; id: string | null; me: Me; go: (p: string) => void; toast: (t: string, k?: 'ok' | 'err') => void; onSaved: () => void }) {
  const [doc, setDoc] = useState<Record<string, unknown> | null>(id ? null : { status: 'draft', priority: 'normal' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const isInbox = !def.publishable;

  useEffect(() => { if (id) api<Doc>(`/c/${def.key}/${id}`).then(setDoc).catch((e) => setError(e.message)); }, [def.key, id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (k: string, v: unknown) => { setDoc((d) => ({ ...d, [k]: v })); setDirty(true); };
  const save = async (status?: string) => {
    if (!doc) return;
    setSaving(true); setError('');
    try {
      const body = { ...doc, ...(status ? { status } : {}) };
      const saved = await api<Doc>(id ? `/c/${def.key}/${id}` : `/c/${def.key}`, { method: id ? 'PUT' : 'POST', body });
      setDirty(false);
      toast(saved.status === 'published' ? `${def.singular} published. The website will update shortly.` : saved.status === 'review' ? 'Submitted for review.' : 'Saved.');
      onSaved();
      if (!id) go(`${def.key}/${saved.id}`); else setDoc(saved);
    } catch (e) { setError((e as Error).message); toast((e as Error).message, 'err'); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!id || !confirm(`Delete this ${def.singular.toLowerCase()} permanently?`)) return;
    try { await api(`/c/${def.key}/${id}`, { method: 'DELETE' }); setDirty(false); toast('Deleted.'); onSaved(); go(def.key); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const setInboxStatus = async (status: string) => {
    try { const d = await api<Doc>(`/c/${def.key}/${id}`, { method: 'PATCH', body: { status } }); setDoc(d); toast('Status updated.'); onSaved(); } catch (e) { toast((e as Error).message, 'err'); }
  };

  if (error && !doc) return <div className="page"><p className="a-msg a-msg--err">{error}</p></div>;
  if (!doc) return <div className="page"><div className="skeleton" style={{ height: 400 }} /></div>;

  const publicPath = def.key === 'news' || def.key === 'events' || def.key === 'albums' ? `/${def.key === 'albums' ? 'gallery' : def.key}/${doc.slug}/` : null;
  const canPublish = can(me.role, 'publish');
  const lockedForMedia = !canPublish && doc.status === 'published' && Boolean(id);

  if (isInbox) {
    const statusField = def.fields.find((f) => f.name === 'status');
    return (
      <div className="page page--narrow">
        <button className="back" onClick={() => go(def.key)}><Icon name="arrow-left" size={16} /> {def.label}</button>
        <div className="card-a">
          <h1>{String(doc[def.titleField] || def.singular)}</h1>
          <dl className="dl-a">
            {def.fields.filter((f) => f.name !== 'status' && f.name !== def.titleField && f.type !== 'textarea').map((f) => (
              <div key={f.name}><dt>{f.label}</dt><dd>{f.type === 'email' && doc[f.name] ? <a href={`mailto:${doc[f.name]}`}>{String(doc[f.name])}</a> : cell(f, doc[f.name])}</dd></div>
            ))}
          </dl>
          {def.fields.filter((f) => f.type === 'textarea').map((f) => <div key={f.name} className="message-body">{String(doc[f.name] || '')}</div>)}
          <div className="row">
            {statusField?.options?.map((s) => <button key={s} className={`a-btn a-btn--sm ${doc.status === s ? '' : 'a-btn--ghost'}`} onClick={() => setInboxStatus(s)}>{s.replace(/_/g, ' ')}</button>)}
            {typeof doc.email === 'string' && <a className="a-btn a-btn--sm a-btn--ghost" href={`mailto:${doc.email}?subject=${encodeURIComponent(`Re: ${doc.subject || 'University Practice SHS'}`)}`}><Icon name="mail" size={15} /> Reply by email</a>}
            <div className="topbar__spacer" />
            <button className="a-btn a-btn--sm a-btn--danger" onClick={remove}><Icon name="trash" size={15} /> Delete</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go(def.key)}><Icon name="arrow-left" size={16} /> {def.label}</button>
      <div className="page__head">
        <div>
          <h1>{id ? String(doc[def.titleField] || `Edit ${def.singular.toLowerCase()}`) : `New ${def.singular.toLowerCase()}`}</h1>
          {id && <p className="muted small">Last updated {fmt(doc.updatedAt)}{doc.updatedBy ? ` by ${doc.updatedBy}` : ''}</p>}
        </div>
        {publicPath && doc.status === 'published' && <a className="a-btn a-btn--ghost a-btn--sm" href={publicPath} target="_blank" rel="noreferrer"><Icon name="eye" size={15} /> View on site</a>}
      </div>
      {lockedForMedia && <div className="callout"><Icon name="lock" /><p>This item is published. Only an editor can change it.</p></div>}
      <fieldset className="form-a" disabled={lockedForMedia || saving}>
        {def.fields.map((f) => (
          <div key={f.name} className={`a-field${f.half ? ' half' : ''}${['markdown', 'gallery', 'image', 'file'].includes(f.type) ? ' wide' : ''}`}>
            <label htmlFor={`f-${f.name}`}>{f.label}{f.required && <b> *</b>}</label>
            {f.name === 'status' && !canPublish ? (
              <select id="f-status" className="a-input" value={String(doc.status || 'draft')} onChange={(e) => set('status', e.target.value)}>
                <option value="draft">draft</option><option value="review">review</option>{doc.status === 'archived' && <option value="archived">archived</option>}
              </select>
            ) : <FieldInput field={f} value={doc[f.name]} onChange={(v) => set(f.name, v)} folder={def.key} />}
            {f.help && <small className="help">{f.help}</small>}
          </div>
        ))}
      </fieldset>
      {error && <p className="a-msg a-msg--err">{error}</p>}
      <div className="actionbar">
        {id && can(me.role, 'delete') && <button className="a-btn a-btn--ghost a-btn--danger" onClick={remove} disabled={saving}><Icon name="trash" size={16} /> Delete</button>}
        <div className="topbar__spacer" />
        {dirty && <span className="muted small">Unsaved changes</span>}
        <button className="a-btn a-btn--ghost" onClick={() => save()} disabled={saving || lockedForMedia}>{saving ? <span className="spinner" /> : null} Save</button>
        {canPublish
          ? <button className="a-btn a-btn--accent" onClick={() => save('published')} disabled={saving}><Icon name="check" size={16} /> {doc.status === 'published' ? 'Update live' : 'Publish'}</button>
          : <button className="a-btn a-btn--accent" onClick={() => save('review')} disabled={saving || lockedForMedia}><Icon name="arrow-up-right" size={16} /> Submit for review</button>}
      </div>
    </div>
  );
}

// ---------------- settings ----------------
function SettingsView({ me, toast }: { me: Me; toast: (t: string, k?: 'ok' | 'err') => void }) {
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api<Record<string, unknown>>('/settings').then(setDoc).catch((e) => toast(e.message, 'err')); }, [toast]);
  if (!doc) return <div className="page"><div className="skeleton" style={{ height: 400 }} /></div>;
  const save = async () => {
    setSaving(true);
    try { setDoc(await api('/settings', { method: 'PUT', body: doc })); toast('Settings saved. The website will update shortly.'); } catch (e) { toast((e as Error).message, 'err'); } finally { setSaving(false); }
  };
  return (
    <div className="page">
      <div className="page__head"><div><h1>Site settings</h1><p className="muted">School details, contact information, homepage text and social links.</p></div></div>
      <fieldset className="form-a" disabled={!can(me.role, 'settings') || saving}>
        {SETTINGS_FIELDS.map((f) => (
          <div key={f.name} className={`a-field${f.half ? ' half' : ''}${['markdown', 'image'].includes(f.type) ? ' wide' : ''}`}>
            <label htmlFor={`f-${f.name}`}>{f.label}</label>
            <FieldInput field={f} value={doc[f.name]} onChange={(v) => setDoc({ ...doc, [f.name]: v })} folder="settings" />
            {f.help && <small className="help">{f.help}</small>}
          </div>
        ))}
      </fieldset>
      <div className="actionbar"><div className="topbar__spacer" /><button className="a-btn a-btn--accent" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : <Icon name="check" size={16} />} Save settings</button></div>
    </div>
  );
}

// ---------------- staff ----------------
function StaffView({ me, toast }: { me: Me; toast: (t: string, k?: 'ok' | 'err') => void }) {
  const [items, setItems] = useState<Doc[] | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const load = useCallback(() => api<{ items: Doc[] }>('/staff').then((r) => setItems(r.items)).catch((e) => toast(e.message, 'err')), [toast]);
  useEffect(() => { load(); }, [load]);
  const saveStaff = async (em: string, body: Record<string, unknown>) => {
    try { await api(`/staff/${encodeURIComponent(em)}`, { method: 'PUT', body }); toast('Access updated.'); load(); } catch (e) { toast((e as Error).message, 'err'); }
  };
  return (
    <div className="page">
      <div className="page__head"><div><h1>Team & access</h1><p className="muted">Give staff access to the portal. They sign in with this email (a Google account, or an email/password account created in Firebase) and must verify it.</p></div></div>
      <form className="card-a invite" onSubmit={(e) => { e.preventDefault(); saveStaff(email, { role, name, active: true }); setEmail(''); setName(''); }}>
        <input className="a-input" type="email" placeholder="staff.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="a-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="a-input" value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
        <button className="a-btn"><Icon name="plus" size={16} /> Add</button>
      </form>
      <div className="roles-help">
        <p><strong>Super admin</strong> — everything, including staff access. <strong>Administrator</strong> — content, settings and inboxes. <strong>Editor</strong> — create, publish and delete content. <strong>Media team</strong> — create drafts and submit for review.</p>
      </div>
      {!items ? <div className="skeleton" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th /></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="td-title">{String(s.name || '—')}</td>
                  <td>{String(s.email)}</td>
                  <td><select className="a-input a-input--sm" value={String(s.role)} onChange={(e) => saveStaff(String(s.email), { ...s, role: e.target.value })} disabled={s.email === me.user.email}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></td>
                  <td><label className="a-switch"><input type="checkbox" checked={s.active !== false} disabled={s.email === me.user.email} onChange={(e) => saveStaff(String(s.email), { ...s, active: e.target.checked })} /><span /></label></td>
                  <td>{s.email !== me.user.email && <button className="icon-only" aria-label="Remove" onClick={async () => { if (confirm(`Remove access for ${s.email}?`)) { try { await api(`/staff/${encodeURIComponent(String(s.email))}`, { method: 'DELETE' }); load(); } catch (e) { toast((e as Error).message, 'err'); } } }}><Icon name="trash" size={16} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActivityView() {
  const [items, setItems] = useState<Doc[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<{ items: Doc[] }>('/audit').then((r) => setItems(r.items)).catch((e) => setError(e.message)); }, []);
  return (
    <div className="page page--narrow">
      <div className="page__head"><div><h1>Activity log</h1><p className="muted">The latest 100 changes made in the staff portal.</p></div></div>
      {error && <p className="a-msg a-msg--err">{error}</p>}
      {!items ? <div className="skeleton" /> : (
        <ol className="activity">
          {items.map((a) => (
            <li key={a.id}><span className={`dot dot--${a.action}`} /><div><strong>{String(a.by)}</strong> {({ create: 'created', update: 'updated', delete: 'deleted', staff: 'changed access for', 'staff-remove': 'removed access for' } as Record<string, string>)[String(a.action)] || String(a.action)} <em>{a.collection === 'staff' ? String(a.docId) : findCollection(String(a.collection))?.singular.toLowerCase() || String(a.collection)}</em>{a.collection !== 'settings' && a.collection !== 'staff' && <a href={`#/${a.collection}/${a.docId}`}> open</a>}<small>{fmt(a.at)}</small></div></li>
          ))}
        </ol>
      )}
      <p className="muted small">API: {API_URL}</p>
    </div>
  );
}
