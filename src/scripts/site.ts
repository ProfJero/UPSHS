// Client behaviour for the public site. Runs on every `astro:page-load` (view transitions).
import { iconSvg } from '../lib/icons';

declare global {
  interface Window {
    UPSHS: { apiUrl: string; turnstileKey: string };
    __upshsApplyTheme?: () => void;
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let globalsReady = false;

export function initSite() {
  if (!globalsReady) { globalsReady = true; initGlobals(); }
  initDropdowns();
  initThemePanel();
  initMobileMenu();
  initReveal();
  initCounters();
  initForms();
  initLightbox();
  initFilters();
  initShare();
  initTilt();
  onScroll();
}

// ---------------- globals (bound once) ----------------

let ticking = false;
function onScroll() {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  document.documentElement.style.setProperty('--progress', String(max > 0 ? Math.min(1, y / max) : 0));
  $('[data-header]')?.classList.toggle('is-scrolled', y > 8);
  $('[data-to-top]')?.classList.toggle('is-shown', y > 900);
  document.documentElement.style.setProperty('--scroll-y', String(y));
}

function initGlobals() {
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => window.__upshsApplyTheme?.());

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-to-top]')) scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (t.closest('[data-cmdk-open]')) { e.preventDefault(); closeMobileMenu(); openCmdk(); }
    // close dropdowns / theme panel when clicking outside
    if (!t.closest('.nav__item')) $$('.nav__item.is-open').forEach(closeDropdown);
    if (!t.closest('.theme')) toggleThemePanel(false);
  });

  document.addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openCmdk(); }
    if (e.key === 'Escape') { closeCmdk(); toggleThemePanel(false); closeMobileMenu(); $$('.nav__item.is-open').forEach(closeDropdown); }
  });

  initCmdk();
  document.addEventListener('astro:before-swap', () => { document.body.style.overflow = ''; });
}

// ---------------- navigation ----------------

function closeDropdown(li: HTMLElement) {
  li.classList.remove('is-open');
  $('[data-dropdown-toggle]', li)?.setAttribute('aria-expanded', 'false');
}

function initDropdowns() {
  $$('.nav__item.has-menu').forEach((li) => {
    const btn = $('[data-dropdown-toggle]', li)!;
    let timer: number | undefined;
    let openedAt = 0;
    const open = () => {
      clearTimeout(timer);
      if (!li.classList.contains('is-open')) openedAt = Date.now();
      $$('.nav__item.is-open').forEach((o) => o !== li && closeDropdown(o));
      li.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    };
    const close = () => { timer = window.setTimeout(() => closeDropdown(li), 140); };
    // A click right after a hover-open should not immediately close the menu.
    btn.addEventListener('click', () => (li.classList.contains('is-open') && Date.now() - openedAt > 400 ? closeDropdown(li) : open()));
    li.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(); });
    li.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') close(); });
    li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget as Node)) closeDropdown(li); });
  });
}

function closeMobileMenu() {
  const menu = $('[data-mobile-menu]');
  if (!menu || menu.hidden) return;
  menu.classList.remove('is-open');
  menu.hidden = true;
  document.body.style.overflow = '';
  $('[data-menu-open]')?.setAttribute('aria-expanded', 'false');
}

function initMobileMenu() {
  const menu = $('[data-mobile-menu]');
  const openBtn = $('[data-menu-open]');
  if (!menu || !openBtn) return;
  openBtn.addEventListener('click', () => {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    openBtn.setAttribute('aria-expanded', 'true');
    $<HTMLButtonElement>('[data-menu-close]', menu)?.focus();
  });
  $('[data-menu-close]', menu)?.addEventListener('click', closeMobileMenu);
  $$('a', menu).forEach((a) => a.addEventListener('click', closeMobileMenu));
}

// ---------------- theme ----------------

function toggleThemePanel(force?: boolean) {
  const panel = $('[data-theme-panel]');
  const btn = $('[data-theme-toggle]');
  if (!panel || !btn) return;
  const show = force ?? panel.hidden;
  panel.hidden = !show;
  btn.setAttribute('aria-expanded', String(show));
}

function syncThemeControls() {
  const d = document.documentElement;
  $$('[data-set-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.setMode === (d.dataset.mode || 'system'))));
  $$('[data-set-accent]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.setAccent === (d.dataset.accent || 'royal'))));
  const motion = $<HTMLInputElement>('[data-motion-toggle]');
  if (motion) motion.checked = d.dataset.motion === 'reduced';
}

function applyTheme(mutate: () => void) {
  const d = document.documentElement;
  d.classList.add('theme-switching');
  const run = () => { mutate(); window.__upshsApplyTheme?.(); syncThemeControls(); };
  const vt = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
  if (vt && !reducedMotion()) vt.call(document, run); else run();
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove('theme-switching')));
}

function initThemePanel() {
  syncThemeControls();
  $('[data-theme-toggle]')?.addEventListener('click', (e) => { e.stopPropagation(); toggleThemePanel(); });
  $$('[data-set-mode]').forEach((b) => b.addEventListener('click', () => applyTheme(() => store.set('upshs-mode', b.dataset.setMode!))));
  $$('[data-set-accent]').forEach((b) => b.addEventListener('click', () => applyTheme(() => store.set('upshs-accent', b.dataset.setAccent!))));
  $<HTMLInputElement>('[data-motion-toggle]')?.addEventListener('change', (e) => {
    store.set('upshs-motion', (e.target as HTMLInputElement).checked ? 'reduced' : 'auto');
    window.__upshsApplyTheme?.();
    if ((e.target as HTMLInputElement).checked) $$('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
  });
}

// ---------------- motion ----------------

function initReveal() {
  const els = $$('[data-reveal]:not(.is-visible)');
  if (reducedMotion() || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
  // stagger children of [data-stagger]
  $$('[data-stagger]').forEach((g) => [...g.children].forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i))));
}

function initCounters() {
  const els = $$('[data-count]');
  const fmt = new Intl.NumberFormat('en-GB');
  const run = (el: HTMLElement) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reducedMotion() || !target) { el.textContent = fmt.format(target) + suffix; return; }
    const dur = 1600, start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      el.textContent = fmt.format(Math.round(target * (1 - Math.pow(1 - p, 4)))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { run(en.target as HTMLElement); io.unobserve(en.target); } }), { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}

function initTilt() {
  if (reducedMotion() || !matchMedia('(hover: hover)').matches) return;
  $$('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-4px)`;
      el.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// ---------------- search (command palette) ----------------

interface SearchItem { t: string; u: string; d: string; k: string; g: string }
let index: SearchItem[] | null = null;
let selected = 0;
let results: SearchItem[] = [];
const GROUP_ICON: Record<string, string> = { Pages: 'compass', News: 'newspaper', Events: 'calendar', Notices: 'megaphone', Downloads: 'download', Gallery: 'images', FAQ: 'info', People: 'user' };

async function loadIndex(): Promise<SearchItem[]> {
  if (index) return index;
  try { index = await (await fetch('/search-index.json')).json(); } catch { index = []; }
  return index!;
}

export function searchItems(items: SearchItem[], q: string, limit = 40): SearchItem[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return items
    .map((it) => {
      const title = it.t.toLowerCase(), hay = `${title} ${it.d} ${it.k}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (!hay.includes(term)) return null;
        score += title.startsWith(term) ? 6 : title.includes(term) ? 4 : it.k.toLowerCase().includes(term) ? 2 : 1;
      }
      return { it, score };
    })
    .filter((x): x is { it: SearchItem; score: number } => Boolean(x))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.it);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function highlight(text: string, q: string): string {
  let out = esc(text);
  for (const term of q.split(/\s+/).filter((t) => t.length > 1)) out = out.replace(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
  return out;
}

const SUGGESTED: SearchItem[] = [
  { t: 'Events calendar', u: '/events/', d: 'Term dates, PTA meetings, sports and more', k: '', g: 'Suggested' },
  { t: 'Notice board', u: '/announcements/', d: 'Official announcements from the school', k: '', g: 'Suggested' },
  { t: 'Downloads', u: '/downloads/', d: 'Forms, prospectus and documents', k: '', g: 'Suggested' },
  { t: 'How do I get admission?', u: '/faq/#admissions', d: 'Placement is through the GES CSSPS', k: '', g: 'Suggested' },
  { t: 'Contact the school', u: '/contact/', d: 'Phone, email, map and enquiry form', k: '', g: 'Suggested' },
];

function renderResults(q: string) {
  const list = $('[data-cmdk-results]');
  if (!list) return;
  const items = q ? results : SUGGESTED;
  $<HTMLAnchorElement>('[data-cmdk-all]')!.href = `/search/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  if (!items.length) { list.innerHTML = `<li class="cmdk__empty">No results for “${esc(q)}”. Try another word.</li>`; return; }
  let html = '', group = '';
  items.slice(0, 12).forEach((it, i) => {
    if (it.g !== group) { group = it.g; html += `<li class="cmdk__group" role="presentation">${esc(group)}</li>`; }
    html += `<li class="cmdk__item" role="option" id="cmdk-opt-${i}" aria-selected="${i === selected}"><a href="${esc(it.u)}"><span class="cmdk__item-icon">${iconSvg(GROUP_ICON[it.g] || 'arrow-right', 18)}</span><span><strong>${highlight(it.t, q)}</strong><small>${highlight(it.d, q)}</small></span></a></li>`;
  });
  list.innerHTML = html;
  $('[data-cmdk-input]')?.setAttribute('aria-activedescendant', `cmdk-opt-${selected}`);
}

function openCmdk() {
  const el = $('[data-cmdk]');
  if (!el || !el.hidden) return;
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  const input = $<HTMLInputElement>('[data-cmdk-input]', el)!;
  input.value = '';
  selected = 0;
  renderResults('');
  setTimeout(() => input.focus(), 20);
  loadIndex();
}

function closeCmdk() {
  const el = $('[data-cmdk]');
  if (!el || el.hidden) return;
  el.hidden = true;
  document.body.style.overflow = '';
}

function initCmdk() {
  const el = $('[data-cmdk]');
  if (!el) return;
  const input = $<HTMLInputElement>('[data-cmdk-input]', el)!;
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-cmdk-close]')) closeCmdk();
    if (t.closest('a')) closeCmdk();
  });
  input.addEventListener('input', async () => {
    const q = input.value.trim();
    results = searchItems(await loadIndex(), q);
    selected = 0;
    renderResults(q);
  });
  input.addEventListener('keydown', (e) => {
    const count = Math.min(12, (input.value.trim() ? results : SUGGESTED).length);
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = (selected + 1) % Math.max(count, 1); renderResults(input.value.trim()); $('[aria-selected="true"]', el)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); selected = (selected - 1 + count) % Math.max(count, 1); renderResults(input.value.trim()); $('[aria-selected="true"]', el)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { e.preventDefault(); $<HTMLAnchorElement>('[aria-selected="true"] a', el)?.click(); }
  });
}

// ---------------- forms ----------------

let turnstileLoading: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  turnstileLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.appendChild(s);
  });
  return turnstileLoading;
}

function initForms() {
  $$<HTMLFormElement>('form[data-api-form]').forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = '1';
    const status = $('[data-status]', form);
    const submit = $<HTMLButtonElement>('[type="submit"]', form)!;
    let widgetId: string | undefined;
    const key = window.UPSHS?.turnstileKey;
    if (key) {
      const box = document.createElement('div');
      box.className = 'turnstile-box full';
      submit.before(box);
      const render = () => loadTurnstile().then(() => { if (window.turnstile && !widgetId) widgetId = window.turnstile.render(box, { sitekey: key, theme: 'auto', size: 'flexible' }); }).catch(() => undefined);
      // load lazily when the user starts interacting
      form.addEventListener('focusin', render, { once: true });
    }
    const setStatus = (state: 'success' | 'error' | '', msg = '') => {
      if (!status) return;
      status.dataset.state = state;
      status.innerHTML = msg ? `${iconSvg(state === 'success' ? 'check-circle' : 'alert', 18)}<span>${esc(msg)}</span>` : '';
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data: Record<string, unknown> = {};
      for (const el of $$<HTMLInputElement>('input, select, textarea', form)) {
        if (!el.name) continue;
        if (el.type === 'checkbox') data[el.name] = el.checked;
        else if (el.type === 'number') data[el.name] = el.value ? Number(el.value) : null;
        else data[el.name] = el.value;
      }
      const token = $<HTMLInputElement>('[name="cf-turnstile-response"]', form)?.value;
      if (key && !token) { setStatus('error', 'Please complete the quick verification check above the button.'); return; }
      if (token) data.turnstileToken = token;
      submit.disabled = true;
      const label = submit.innerHTML;
      submit.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';
      setStatus('');
      try {
        const res = await fetch(`${window.UPSHS.apiUrl}${form.dataset.apiForm}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
        form.reset();
        setStatus('success', status?.dataset.success || 'Thank you. Your message has been sent.');
      } catch (err) {
        setStatus('error', err instanceof TypeError ? 'We could not reach the school server. Please check your connection and try again.' : (err as Error).message);
      } finally {
        submit.disabled = false;
        submit.innerHTML = label;
        if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
      }
    });
  });
}

// ---------------- lightbox ----------------

function initLightbox() {
  $$('[data-lightbox]').forEach((gallery) => {
    const items = $$<HTMLAnchorElement>('a[data-lb-item]', gallery);
    if (!items.length) return;
    let i = 0;
    let box: HTMLDivElement | null = null;
    const show = (n: number) => {
      i = (n + items.length) % items.length;
      const a = items[i]!;
      const img = $<HTMLImageElement>('.lb__img', box!)!;
      img.classList.remove('is-in');
      img.src = a.href;
      img.alt = a.dataset.alt || '';
      img.onload = () => img.classList.add('is-in');
      $('.lb__caption', box!)!.textContent = a.dataset.caption || '';
      $('.lb__count', box!)!.textContent = `${i + 1} / ${items.length}`;
    };
    const close = () => { box?.remove(); box = null; document.body.style.overflow = ''; items[i]?.focus(); removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'Escape') close(); };
    items.forEach((a, n) => a.addEventListener('click', (e) => {
      e.preventDefault();
      box = document.createElement('div');
      box.className = 'lb';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Photo viewer');
      box.innerHTML = `<button class="lb__btn lb__close" aria-label="Close">${iconSvg('x', 22)}</button><button class="lb__btn lb__prev" aria-label="Previous photo">${iconSvg('chevron-left', 26)}</button><figure><img class="lb__img" alt="" /><figcaption><span class="lb__caption"></span><span class="lb__count"></span></figcaption></figure><button class="lb__btn lb__next" aria-label="Next photo">${iconSvg('chevron-right', 26)}</button>`;
      document.body.appendChild(box);
      document.body.style.overflow = 'hidden';
      $('.lb__close', box)!.addEventListener('click', close);
      $('.lb__prev', box)!.addEventListener('click', () => show(i - 1));
      $('.lb__next', box)!.addEventListener('click', () => show(i + 1));
      box.addEventListener('click', (ev) => { if (ev.target === box) close(); });
      let sx = 0;
      box.addEventListener('touchstart', (ev) => { sx = ev.touches[0]!.clientX; }, { passive: true });
      box.addEventListener('touchend', (ev) => { const dx = ev.changedTouches[0]!.clientX - sx; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); });
      addEventListener('keydown', onKey);
      show(n);
      $<HTMLButtonElement>('.lb__close', box)!.focus();
    }));
  });
}

// ---------------- filters ----------------

function initFilters() {
  $$('[data-filter-group]').forEach((group) => {
    const target = $(group.dataset.filterGroup!);
    if (!target) return;
    const buttons = $$<HTMLButtonElement>('[data-filter]', group);
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const value = btn.dataset.filter!;
      const apply = () => {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        let shown = 0;
        $$('[data-filter-item]', target).forEach((item) => {
          const match = value === 'all' || (item.dataset.category || '').split('|').includes(value);
          item.hidden = !match;
          if (match) shown++;
        });
        const empty = $('[data-filter-empty]', target.parentElement || document);
        if (empty) empty.hidden = shown > 0;
      };
      const vt = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
      if (vt && !reducedMotion()) vt.call(document, apply); else apply();
    }));
  });
}

function initShare() {
  $$('[data-share]').forEach((btn) => btn.addEventListener('click', async () => {
    const data = { title: document.title, url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } return; }
    await navigator.clipboard?.writeText(location.href);
    const label = btn.querySelector('span');
    if (label) { const old = label.textContent; label.textContent = 'Link copied'; setTimeout(() => (label.textContent = old), 1800); }
  }));
}
