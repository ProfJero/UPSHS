import { useEffect, useRef, useState, type FormEvent } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string,unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export default function ContactForm() {
  const [state, setState] = useState<'idle'|'sending'|'success'|'error'>('idle');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const mountRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [siteKey, setSiteKey] = useState('');

  useEffect(() => {
    setSiteKey(window.__UPSHS_CONFIG__?.turnstileSiteKey || '');
  }, []);

  useEffect(() => {
    if (!siteKey || !mountRef.current) return;
    let active = true;
    const renderWidget = () => {
      if (!active || !mountRef.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(mountRef.current, {
        sitekey: siteKey,
        callback: (value: string) => setToken(value),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
        theme: 'light',
      });
    };
    if (window.turnstile) renderWidget();
    else {
      let script = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true; script.defer = true; script.dataset.turnstile = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
    }
    return () => {
      active = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [siteKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (String(data.get('website') || '').trim()) return;
    if (!siteKey) { setState('error'); setMessage('The enquiry service is not configured yet. Please use the school’s verified contact channels.'); return; }
    if (!token) { setState('error'); setMessage('Please complete the verification check before sending.'); return; }
    setState('sending'); setMessage('');
    const payload = {
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      subject: String(data.get('subject') || '').trim(),
      message: String(data.get('message') || '').trim(),
      website: String(data.get('website') || ''),
      turnstileToken: token,
    };
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Your message could not be sent.');
      form.reset(); setState('success'); setMessage('Thank you. Your enquiry has been submitted to the school.');
    } catch (error) {
      setState('error'); setMessage(error instanceof Error ? error.message : 'Your message could not be sent. Please try again later.');
    } finally {
      setToken('');
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    }
  }

  return <form className="contact-form" onSubmit={submit}>
    <div className="form-row"><label>Full name<input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Your full name" /></label><label>Email address<input type="email" name="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label></div>
    <label>Subject<input name="subject" required minLength={3} maxLength={160} placeholder="What is your enquiry about?" /></label>
    <label>Message<textarea name="message" required minLength={10} maxLength={4000} rows={6} placeholder="Write your message here…" /></label>
    <div className="honeypot" aria-hidden="true"><label>Leave this field empty<input tabIndex={-1} name="website" autoComplete="off" /></label></div>
    {siteKey ? <div><div ref={mountRef} /><p className="form-note">This website uses Cloudflare Turnstile to help prevent automated submissions.</p></div> : <p className="form-note">The enquiry form will be enabled after the school website administrator configures its verification service.</p>}
    <button className="button button--primary" type="submit" disabled={state === 'sending' || !siteKey}>{state === 'sending' ? 'Sending…' : 'Send enquiry'} <span>↗</span></button>
    {message && <p className={`form-feedback form-feedback--${state}`} role="status">{message}</p>}
    <p className="form-note">Please do not submit confidential student, health or financial information through this form.</p>
  </form>;
}
