import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { getBrowserSupabase } from '../lib/supabase';

type Role = 'super_admin'|'admin'|'editor'|'media'|'viewer';
type Tab = 'overview'|'news_posts'|'announcements'|'events'|'pages'|'gallery_albums'|'gallery_items'|'news_categories'|'site_settings'|'contact_messages'|'profiles';
type Field = { name:string; label:string; type?:'text'|'textarea'|'select'|'url'|'datetime'|'email'; required?:boolean; options?:{value:string;label:string}[]; full?:boolean; hint?:string };
type RowData = Record<string, any> & { id?:string };

const config: Record<Exclude<Tab,'overview'|'contact_messages'|'profiles'>,{label:string;description:string;fields:Field[];columns:string[]}> = {
  news_posts:{label:'News & stories',description:'Draft, review and publish school news and achievements.',columns:['title','category_id','status','published_at'],fields:[
    {name:'title',label:'Article title',required:true},{name:'slug',label:'URL slug',required:true,hint:'Use lowercase words separated by hyphens.'},{name:'excerpt',label:'Short summary',type:'textarea',full:true},{name:'content',label:'Article content',type:'textarea',full:true,required:true,hint:'Use blank lines to separate paragraphs.'},{name:'category_id',label:'Category',type:'select',options:[{value:'',label:'Uncategorised'}]},{name:'cover_image_url',label:'Cover image URL',type:'url'},{name:'status',label:'Publication status',type:'select',options:[{value:'draft',label:'Draft'},{value:'review',label:'Needs review'},{value:'published',label:'Published'},{value:'archived',label:'Archived'}]}
  ]},
  announcements:{label:'Announcements',description:'Publish notices that should be easy for families and students to find.',columns:['title','priority','status','published_at'],fields:[{name:'title',label:'Announcement title',required:true},{name:'body',label:'Announcement details',type:'textarea',full:true,required:true},{name:'priority',label:'Priority',type:'select',options:[{value:'normal',label:'Normal'},{value:'important',label:'Important'},{value:'urgent',label:'Urgent'}]},{name:'link_url',label:'Optional information link',type:'url'},{name:'status',label:'Status',type:'select',options:[{value:'draft',label:'Draft'},{value:'published',label:'Published'},{value:'archived',label:'Archived'}]},{name:'expires_at',label:'Expiry date',type:'datetime'}]},
  events:{label:'Events & calendar',description:'Manage upcoming school activities and important dates.',columns:['title','starts_at','location','status'],fields:[{name:'title',label:'Event title',required:true},{name:'slug',label:'URL slug',required:true},{name:'description',label:'Description',type:'textarea',full:true},{name:'location',label:'Location'},{name:'starts_at',label:'Starts at',type:'datetime',required:true},{name:'ends_at',label:'Ends at',type:'datetime'},{name:'cover_image_url',label:'Cover image URL',type:'url'},{name:'status',label:'Status',type:'select',options:[{value:'draft',label:'Draft'},{value:'review',label:'Needs review'},{value:'published',label:'Published'},{value:'archived',label:'Archived'}]}]},
  pages:{label:'Website pages',description:'Manage editable information pages such as history, admissions and school profile.',columns:['title','slug','status','updated_at'],fields:[{name:'title',label:'Page title',required:true},{name:'slug',label:'URL slug',required:true},{name:'summary',label:'Short summary',type:'textarea',full:true},{name:'content',label:'Page content',type:'textarea',full:true,required:true},{name:'hero_image_url',label:'Hero image URL',type:'url'},{name:'meta_description',label:'Search description',type:'textarea',full:true},{name:'status',label:'Status',type:'select',options:[{value:'draft',label:'Draft'},{value:'review',label:'Needs review'},{value:'published',label:'Published'},{value:'archived',label:'Archived'}]}]},
  gallery_albums:{label:'Photo albums',description:'Create albums and organise approved school photographs.',columns:['title','slug','status','created_at'],fields:[{name:'title',label:'Album title',required:true},{name:'slug',label:'URL slug',required:true},{name:'description',label:'Album description',type:'textarea',full:true},{name:'cover_image_url',label:'Cover image URL',type:'url'},{name:'status',label:'Status',type:'select',options:[{value:'draft',label:'Draft'},{value:'review',label:'Needs review'},{value:'published',label:'Published'},{value:'archived',label:'Archived'}]}]},
  news_categories:{label:'News categories',description:'Organise articles by topic.',columns:['name','slug','description'],fields:[{name:'name',label:'Category name',required:true},{name:'slug',label:'URL slug',required:true},{name:'description',label:'Description',type:'textarea',full:true}]},
  gallery_items:{label:'Gallery photos',description:'Add approved photographs to school albums.',columns:['album_id','caption','status','display_order'],fields:[{name:'album_id',label:'Album',type:'select',required:true,options:[{value:'',label:'Choose an album'}]},{name:'image_url',label:'Image URL (optional when uploading)',type:'url'},{name:'caption',label:'Caption'},{name:'alt_text',label:'Accessible image description'},{name:'display_order',label:'Display order'},{name:'status',label:'Review status',type:'select',options:[{value:'draft',label:'Draft'},{value:'review',label:'Needs review'},{value:'published',label:'Published'},{value:'archived',label:'Archived'}]}]},
  site_settings:{label:'Website settings',description:'Update public school identity and contact details.',columns:['school_name','motto','location','public_email'],fields:[{name:'school_name',label:'Official school name',required:true},{name:'short_name',label:'Short name',required:true},{name:'motto',label:'School motto',required:true},{name:'location',label:'Location',required:true},{name:'public_email',label:'Public email',type:'email'},{name:'public_phone',label:'Public telephone'},{name:'postal_address',label:'Postal address',type:'textarea',full:true},{name:'social_links',label:'Social links JSON',type:'textarea',full:true,hint:'Enter a valid JSON object of approved social URLs.'}]}
};
const nav: {id:Tab;label:string;roles:Role[]}[] = [
  {id:'overview',label:'Overview',roles:['super_admin','admin','editor','media','viewer']},
  {id:'news_posts',label:'News & stories',roles:['super_admin','admin','editor','media']},
  {id:'announcements',label:'Announcements',roles:['super_admin','admin','editor']},
  {id:'events',label:'Events & calendar',roles:['super_admin','admin','editor','media']},
  {id:'pages',label:'Website pages',roles:['super_admin','admin','editor']},
  {id:'gallery_albums',label:'Photo albums',roles:['super_admin','admin','editor','media']},
  {id:'gallery_items',label:'Gallery photos',roles:['super_admin','admin','editor','media']},
  {id:'news_categories',label:'News categories',roles:['super_admin','admin','editor']},
  {id:'site_settings',label:'Website settings',roles:['super_admin','admin']},
  {id:'contact_messages',label:'Enquiries',roles:['super_admin','admin','editor']},
  {id:'profiles',label:'Team & access',roles:['super_admin']},
];
const slugify = (text:string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const prettyDate = (value:any) => value ? new Date(value).toLocaleString('en-GH',{dateStyle:'medium',timeStyle:'short'}) : '—';
const toLocalDatetime = (value:any) => { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0,16); };

export default function AdminApp() {
  const client = getBrowserSupabase();
  const [session,setSession] = useState<any>(null);
  const [profile,setProfile] = useState<any>(null);
  const [checking,setChecking] = useState(true);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [newPassword,setNewPassword] = useState('');
  const [recoveryMode,setRecoveryMode] = useState(false);
  const [tab,setTab] = useState<Tab>('overview');
  const [rows,setRows] = useState<RowData[]>([]);
  const [counts,setCounts] = useState<Record<string,number>>({});
  const [categories,setCategories] = useState<RowData[]>([]);
  const [loading,setLoading] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [editing,setEditing] = useState<RowData|null>(null);
  const [values,setValues] = useState<RowData>({});
  const [imageFile,setImageFile] = useState<File|null>(null);
  const [saving,setSaving] = useState(false);
  const role = profile?.role as Role|undefined;

  const checkSession = useCallback(async () => {
    if (!client) { setChecking(false); return; }
    const {data:{session:current}} = await client.auth.getSession();
    setSession(current);
    if (current?.user) {
      const {data:userProfile} = await client.from('profiles').select('id,full_name,role').eq('id',current.user.id).maybeSingle();
      setProfile(userProfile);
    } else setProfile(null);
    setChecking(false);
  },[client]);

  useEffect(() => {
    checkSession();
    if (window.location.hash.includes('type=recovery')) setRecoveryMode(true);
    if (!client) return;
    const {data:{subscription}} = client.auth.onAuthStateChange((event,next) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      setSession(next);
      if (!next) { setProfile(null); setRows([]); }
      else window.setTimeout(() => checkSession(),0);
    });
    return () => subscription.unsubscribe();
  },[client,checkSession]);

  const loadTab = useCallback(async (target:Tab) => {
    if (!client || !session?.user) return;
    setLoading(true); setError(''); setNotice('');
    if (target === 'overview') {
      const tables = ['news_posts','announcements','events','pages','gallery_albums','contact_messages'];
      const results = await Promise.all(tables.map((table) => client.from(table).select('id',{count:'exact',head:true})));
      const next:Record<string,number> = {};
      tables.forEach((table,index) => next[table] = results[index]?.count ?? 0);
      setCounts(next); setLoading(false); return;
    }
    if (target === 'site_settings') {
      const {data:settings,error:settingsError} = await client.from('site_settings').select('*').eq('id',true).single();
      if (settingsError) setError(settingsError.message); else setValues({...settings, social_links: JSON.stringify(settings.social_links || {}, null, 2)});
      setRows([]); setLoading(false); return;
    }
    const sortColumn = target === 'events' ? 'starts_at' : target === 'profiles' ? 'full_name' : 'created_at';
    const orderQuery = client.from(target).select('*').order(sortColumn,{ascending:target === 'events'}).limit(100);
    const {data,error:queryError} = await orderQuery;
    if (queryError) setError(queryError.message); else setRows((data||[]) as RowData[]);
    if (target === 'news_posts') {
      const {data:cats} = await client.from('news_categories').select('id,name').order('name');
      setCategories(cats || []);
    }
    if (target === 'gallery_items') {
      const {data:albums} = await client.from('gallery_albums').select('id,title').order('title');
      setCategories((albums || []).map((album:any)=>({id:album.id,name:album.title})));
    }
    setLoading(false);
  },[client,session]);

  useEffect(() => { if (role && nav.some((item) => item.id === tab && item.roles.includes(role))) loadTab(tab); },[tab,role,loadTab]);

  async function signIn(event:FormEvent) {
    event.preventDefault(); if (!client) return;
    setSaving(true); setError('');
    const {error:signInError} = await client.auth.signInWithPassword({email,password});
    if (signInError) setError(signInError.message);
    else { setNotice('Signed in. Checking your assigned access…'); await checkSession(); }
    setSaving(false);
  }

  async function sendPasswordReset() {
    if (!client || !email.trim()) { setError('Enter your staff email address first.'); return; }
    setSaving(true); setError(''); setNotice('');
    const {error:resetError} = await client.auth.resetPasswordForEmail(email.trim(), {redirectTo: `${window.location.origin}/admin/`});
    if (resetError) setError(resetError.message); else setNotice('Password reset instructions have been sent if this email belongs to an authorised account.');
    setSaving(false);
  }

  async function updatePassword(event:FormEvent) {
    event.preventDefault();
    if (!client || newPassword.length < 12) { setError('Use a password with at least 12 characters.'); return; }
    setSaving(true); setError('');
    const {error:updateError} = await client.auth.updateUser({password:newPassword});
    if (updateError) setError(updateError.message);
    else { setRecoveryMode(false); setNewPassword(''); setNotice('Your password has been updated.'); window.history.replaceState({}, document.title, '/admin/'); await checkSession(); }
    setSaving(false);
  }

  async function signOut() { if (client) await client.auth.signOut(); setSession(null); setProfile(null); }

  function openNew() {
    const initial:RowData = {};
    const fields = config[tab as keyof typeof config]?.fields || [];
    fields.forEach((field) => { initial[field.name] = field.name === 'status' ? 'draft' : field.name === 'priority' ? 'normal' : ''; });
    if (tab === 'news_posts') initial.category_id = '';
    if (tab === 'gallery_items') initial.album_id = '';
    if (tab === 'site_settings') initial.social_links = '{}';
    setEditing(null); setValues(initial); setImageFile(null); setError(''); setNotice('');
  }
  function openEdit(row:RowData) {
    const next = {...row};
    if (role === 'media' && !['draft','review'].includes(String(next.status))) next.status = 'review';
    setEditing(row); setValues(next); setImageFile(null); setError(''); setNotice('');
  }
  function changeValue(name:string,value:any) {
    setValues((current) => {
      const next = {...current,[name]:value};
      if (name === 'title' && !editing) next.slug = slugify(String(value));
      return next;
    });
  }

  async function saveRow(event:FormEvent) {
    event.preventDefault(); if (!client || !config[tab as keyof typeof config]) return;
    setSaving(true); setError(''); setNotice('');
    const payload:RowData = {...values};
    const userId = session.user.id;
    if (['news_posts','announcements','events','pages','gallery_albums'].includes(tab)) {
      if (tab === 'news_posts') payload.author_id = userId;
      else payload.created_by = userId;
    }
    for (const key of Object.keys(payload)) if (payload[key] === '') payload[key] = null;
    if (payload.status === 'published' && !payload.published_at && tab === 'news_posts') payload.published_at = new Date().toISOString();
    if (payload.status === 'published' && tab === 'announcements' && !payload.published_at) payload.published_at = new Date().toISOString();
    if (tab === 'news_posts' && !payload.category_id) payload.category_id = null;
    if (tab === 'site_settings') {
      try { payload.social_links = payload.social_links ? JSON.parse(payload.social_links) : {}; }
      catch { setError('Social links must be valid JSON.'); setSaving(false); return; }
      delete payload.id; delete payload.updated_at; delete payload.updated_by;
    }
    if (imageFile && ['news_posts','events','gallery_albums','gallery_items'].includes(tab)) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${tab}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;
      const {error:uploadError} = await client.storage.from('upshs-media').upload(path,imageFile,{upsert:false,contentType:imageFile.type || undefined});
      if (uploadError) { setError(`Image upload failed: ${uploadError.message}`); setSaving(false); return; }
      if (tab === 'gallery_items') payload.image_url = client.storage.from('upshs-media').getPublicUrl(path).data.publicUrl;
      else payload.cover_image_url = client.storage.from('upshs-media').getPublicUrl(path).data.publicUrl;
    }
    if (['events','announcements'].includes(tab) && payload.expires_at) payload.expires_at = new Date(payload.expires_at).toISOString();
    if (tab === 'events') {
      if (payload.starts_at) payload.starts_at = new Date(payload.starts_at).toISOString();
      if (payload.ends_at) payload.ends_at = new Date(payload.ends_at).toISOString();
    }
    if (tab === 'news_posts' && payload.status === 'published' && !payload.published_at) payload.published_at = new Date().toISOString();
    if (tab === 'gallery_items') payload.display_order = Number(payload.display_order || 0);
    if (tab === 'site_settings') {
      payload.updated_by = userId;
      const {error:settingsError} = await client.from('site_settings').update(payload).eq('id',true);
      if (settingsError) setError(settingsError.message); else { setNotice('Website settings saved.'); await loadTab('site_settings'); }
      setSaving(false); return;
    }
    const operation = editing?.id ? client.from(tab).update(payload).eq('id',editing.id) : client.from(tab).insert(payload);
    const {error:saveError} = await operation;
    if (saveError) setError(saveError.message);
    else { setNotice(editing ? 'Changes saved.' : 'New item created.'); setEditing(null); setValues({}); setImageFile(null); await loadTab(tab); }
    setSaving(false);
  }

  async function deleteRow(row:RowData) {
    if (!client || !row.id || !window.confirm('Delete this item? This cannot be undone.')) return;
    const {error:deleteError} = await client.from(tab).delete().eq('id',row.id);
    if (deleteError) setError(deleteError.message); else { setNotice('Item deleted.'); await loadTab(tab); }
  }

  async function updateMessage(row:RowData,status:string) {
    if (!client) return;
    const {error:updateError} = await client.from('contact_messages').update({status}).eq('id',row.id);
    if (updateError) setError(updateError.message); else { setNotice('Enquiry status updated.'); await loadTab('contact_messages'); }
  }

  async function updateRole(row:RowData,newRole:string) {
    if (!client || role !== 'super_admin') return;
    const {error:updateError} = await client.from('profiles').update({role:newRole}).eq('id',row.id);
    if (updateError) setError(updateError.message); else { setNotice('Team role updated.'); await loadTab('profiles'); }
  }

  const visibleRows = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())),[rows,search]);
  const activeConfig = config[tab as keyof typeof config];
  const title = nav.find((item) => item.id === tab)?.label || 'Overview';

  if (checking) return <div className="admin-login"><h1>UNIPRA Admin</h1><p>Checking secure session…</p></div>;
  if (!client) return <div className="admin-login"><h1>Admin portal setup required</h1><p>The Supabase connection has not been configured. Add the public Supabase URL and publishable key to your Cloudflare Worker environment, then redeploy.</p><a className="button button--outline" href="/">Back to website</a></div>;
  if (recoveryMode) return <div className="admin-login"><span className="eyebrow"><span></span> Secure account recovery</span><h1>Choose a new password.</h1><p>Use at least 12 characters. This updates the password for your authorised staff account.</p><form onSubmit={updatePassword}><label>New password<input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} minLength={12} autoComplete="new-password" required placeholder="At least 12 characters"/></label><button className="button button--primary" disabled={saving}>{saving?'Updating…':'Update password'} <span>↗</span></button>{error && <div className="admin-error">{error}</div>}</form><p className="admin-user">If the recovery link has expired, return to sign in and request another.</p><a className="text-link" href="/admin/">← Back to staff access</a></div>;
  if (!session) return <div className="admin-login"><span className="eyebrow"><span></span> Secure staff access</span><h1>Welcome back.</h1><p>Sign in using an account created by the authorised website administrator. Public self-registration is disabled.</p><form onSubmit={signIn}><label>Email address<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="username" required placeholder="name@school.edu.gh"/></label><label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required placeholder="Your password"/></label><button className="button button--primary" disabled={saving}>{saving?'Signing in…':'Sign in'} <span>↗</span></button><button type="button" className="admin-reset-link" disabled={saving} onClick={sendPasswordReset}>Forgot password? Send reset link</button>{error && <div className="admin-error">{error}</div>}{notice && <div className="admin-success">{notice}</div>}</form><p className="admin-user">Need access? Contact the school's designated website administrator. Accounts are not created from this page.</p><a className="text-link" href="/">← Return to the public website</a></div>;
  if (!profile || !role) return <div className="admin-login"><h1>Access not assigned</h1><p>Your account is signed in, but it does not have a publishing role on the UNIPRA website. Contact the super administrator.</p><button className="button button--outline" onClick={signOut}>Sign out</button></div>;

  return <div className="admin-shell">
    <aside className="admin-sidebar"><h3>UNIPRA CMS</h3>{nav.filter((item)=>item.roles.includes(role)).map((item)=><button className={tab===item.id?'active':''} key={item.id} onClick={()=>{setTab(item.id);setEditing(null);setValues({});setSearch('');setError('');setNotice('');}}>{item.label}</button>)}<div className="admin-sidebar__bottom"><span className="admin-user">{profile.full_name || session.user.email}<br/>{role.replace('_',' ')}</span><button onClick={signOut}>Sign out ↗</button></div></aside>
    <section className="admin-content"><div className="admin-top"><div><span className="eyebrow"><span></span> Website administration</span><h1>{title}</h1><p className="admin-muted">Manage the information presented on the public UNIPRA website.</p></div><a className="small-button" href="/" target="_blank" rel="noreferrer">View website ↗</a></div>
      {notice && <div className="admin-success">{notice}</div>}{error && <div className="admin-error">{error}</div>}
      {tab==='overview' && <><div className="admin-cards">{[['news_posts','News stories'],['announcements','Announcements'],['events','Events'],['pages','Pages'],['gallery_albums','Photo albums'],['contact_messages','Enquiries']].map(([key,label])=><div className="admin-card" key={key}><span>{label}</span><strong>{counts[key!] ?? '—'}</strong></div>)}</div><div className="admin-welcome"><h2>Welcome to the UNIPRA website dashboard.</h2><p>Use the sections on the left to manage news, notices, events, pages and approved school photographs. Please ensure all content is accurate and authorised before publishing.</p><div className="admin-guidance"><strong>Publishing reminder</strong><p>Student images, personal information, official notices and school statements must follow the school's approval and privacy procedures.</p></div></div></>}
      {activeConfig && <><div className="admin-toolbar"><input aria-label="Search records" placeholder="Search records…" value={search} onChange={(e)=>setSearch(e.target.value)}/>{tab!=='site_settings' && <button className="button button--primary" onClick={openNew}>＋ Add new</button>}</div>{(editing || Object.keys(values).length>0) && <form className="admin-form" onSubmit={saveRow}>{activeConfig.fields.map((field)=>{
        let fieldOptions = field.name==='category_id' ? [{value:'',label:'Uncategorised'},...categories.map((cat)=>({value:cat.id,label:cat.name}))] : field.name==='album_id' ? [{value:'',label:'Choose an album'},...categories.map((cat)=>({value:cat.id,label:cat.name}))] : field.options;
        if (field.name === 'status' && role === 'media') fieldOptions = (fieldOptions || []).filter((option)=>['draft','review'].includes(option.value ?? ''));
        const value = values[field.name] ?? '';
        return <label className={field.full?'span-2':''} key={field.name}>{field.label}{field.type==='textarea' ? <textarea required={field.required} value={value} onChange={(e)=>changeValue(field.name,e.target.value)} placeholder={field.hint || field.label}/> : field.type==='select' ? <select required={field.required} value={value || ''} onChange={(e)=>changeValue(field.name,e.target.value)}>{(fieldOptions||[]).map((option)=><option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input type={field.type==='datetime'?'datetime-local':field.type==='url'?'url':field.type==='email'?'email':'text'} required={field.required} value={field.type==='datetime' ? toLocalDatetime(value) : value} onChange={(e)=>changeValue(field.name,e.target.value)} placeholder={field.hint || field.label}/>}{field.hint && <small className="admin-muted">{field.hint}</small>}</label>;
      })}{['news_posts','events','gallery_albums','gallery_items'].includes(tab) && <label className="span-2">Upload cover image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>setImageFile(e.target.files?.[0]||null)}/><small className="admin-muted">Use school-approved photographs only. Maximum recommended file size: 5 MB.</small></label>}<div className="span-2 admin-actions"><button className="button button--primary" disabled={saving}>{saving?'Saving…':tab==='site_settings'?'Save settings':editing?'Save changes':'Create item'}</button><button type="button" className="small-button" onClick={()=>{setEditing(null);setValues({});setImageFile(null);}}>Cancel</button></div></form>}
        {tab==='site_settings' ? <p className="admin-muted">These details are shown on the public website. Only publish contact information approved by school management.</p> : loading?<p className="admin-muted">Loading records…</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr>{activeConfig.columns.map((col)=><th key={col}>{col.replaceAll('_',' ')}</th>)}<th>Actions</th></tr></thead><tbody>{visibleRows.map((row)=><tr key={row.id}>{activeConfig.columns.map((col)=><td key={col}>{col==='status'?<span className={`status-pill status-pill--${row[col]}`}>{row[col]}</span>:col.endsWith('_at')?prettyDate(row[col]):col==='category_id'?(categories.find((c)=>c.id===row[col])?.name||'—'):String(row[col]??'—').slice(0,100)}</td>)}<td><div className="admin-actions"><button onClick={()=>openEdit(row)}>Edit</button>{(['super_admin','admin'].includes(role) || (role==='editor' && tab==='news_categories')) && <button onClick={()=>deleteRow(row)}>Delete</button>}</div></td></tr>)}{!visibleRows.length && <tr><td colSpan={activeConfig.columns.length+1}>No records found.</td></tr>}</tbody></table></div>}</>}
      {tab==='contact_messages' && <><div className="admin-toolbar"><input placeholder="Search enquiries…" value={search} onChange={(e)=>setSearch(e.target.value)}/><button className="small-button" onClick={()=>loadTab(tab)}>Refresh</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Received</th><th>Name</th><th>Email</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleRows.map((row)=><tr key={row.id}><td>{prettyDate(row.created_at)}</td><td>{row.name}</td><td>{row.email}</td><td>{row.subject}</td><td><span className="status-pill">{row.status}</span></td><td><div className="admin-actions"><button onClick={()=>window.alert(`Message from ${row.name}\n\n${row.message}`)}>Read</button>{row.status!=='read'&&<button onClick={()=>updateMessage(row,'read')}>Mark read</button>}</div></td></tr>)}{!visibleRows.length&&<tr><td colSpan={6}>No enquiries found.</td></tr>}</tbody></table></div></>}
      {tab==='profiles' && <><p className="admin-muted">Manage publishing access for accounts created by the authorised Supabase administrator. New accounts must first be created in Supabase Auth.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Account ID</th><th>Role</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id}><td>{row.full_name||'—'}</td><td>{row.id}</td><td><select aria-label={`Role for ${row.full_name}`} value={row.role} onChange={(e)=>updateRole(row,e.target.value)}>{['viewer','media','editor','admin','super_admin'].map((item)=><option value={item}>{item.replace('_',' ')}</option>)}</select></td></tr>)}{!rows.length&&<tr><td colSpan={3}>No team profiles found.</td></tr>}</tbody></table></div></>}
      <div className="admin-footer-note">UNIPRA website CMS · All changes are subject to the school's content and publication policy.</div>
    </section>
  </div>;
}
