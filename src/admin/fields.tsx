import { useRef, useState, type ReactNode } from 'react';
import { marked } from 'marked';
import type { Field } from '../../shared/collections';
import { iconSvg } from '../lib/icons';
import { thumb, upload } from './api';

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <span className="ai" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(name, size) }} />;
}

type Img = { url: string; alt?: string; caption?: string; publicId?: string; width?: number | null; height?: number | null };
type FileRef = { url: string; name?: string; bytes?: number | null; format?: string; publicId?: string };

const toLocal = (iso: unknown, dateOnly = false) => {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return dateOnly ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function Uploader({ folder, accept, multiple, onDone, children }: { folder: string; accept: string; multiple?: boolean; onDone: (r: Awaited<ReturnType<typeof upload>>[]) => void; children: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const out = [];
    try {
      for (const [i, f] of [...files].entries()) {
        if (f.size > 20 * 1024 * 1024) throw new Error(`${f.name} is larger than 20 MB.`);
        out.push(await upload(f, folder, (p) => setProgress(Math.round(((i + p / 100) / files.length) * 100))));
      }
      onDone(out);
    } catch (e) {
      setError((e as Error).message);
      if (out.length) onDone(out);
    } finally {
      setProgress(null);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <div
      className={`dropzone${drag ? ' is-drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
    >
      <input ref={ref} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => handle(e.target.files)} />
      {progress !== null ? (
        <div className="dropzone__progress"><div style={{ width: `${progress}%` }} /><span>Uploading… {progress}%</span></div>
      ) : (
        <button type="button" className="dropzone__btn" onClick={() => ref.current?.click()}>{children}</button>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function FieldInput({ field, value, onChange, folder }: { field: Field; value: unknown; onChange: (v: unknown) => void; folder: string }) {
  const id = `f-${field.name}`;
  const [preview, setPreview] = useState(false);
  switch (field.type) {
    case 'textarea':
      return <textarea id={id} className="a-input a-textarea" value={(value as string) || ''} maxLength={field.max} onChange={(e) => onChange(e.target.value)} rows={4} />;
    case 'markdown':
      return (
        <div className="md">
          <div className="md__tabs">
            <button type="button" className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>Write</button>
            <button type="button" className={preview ? 'on' : ''} onClick={() => setPreview(true)}>Preview</button>
            <span className="md__hint">Markdown: **bold**, _italic_, ## heading, - list, [link](https://…)</span>
          </div>
          {preview
            ? <div className="md__preview prose" dangerouslySetInnerHTML={{ __html: marked.parse(String(value || '').replace(/</g, '&lt;'), { async: false }) as string }} />
            : <textarea id={id} className="a-input a-textarea md__area" value={(value as string) || ''} maxLength={field.max} onChange={(e) => onChange(e.target.value)} rows={14} />}
        </div>
      );
    case 'select':
      return (
        <select id={id} className="a-input" value={(value as string) || ''} onChange={(e) => onChange(e.target.value)}>
          {field.name !== 'status' && <option value="">—</option>}
          {field.options?.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
      );
    case 'boolean':
      return <label className="a-switch"><input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /><span /> {value ? 'Yes' : 'No'}</label>;
    case 'number':
      return <input id={id} className="a-input" type="number" value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'datetime':
      return <input id={id} className="a-input" type="datetime-local" value={toLocal(value)} onChange={(e) => onChange(fromLocal(e.target.value))} />;
    case 'date':
      return <input id={id} className="a-input" type="date" value={toLocal(value, true)} onChange={(e) => onChange(e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null)} />;
    case 'tags':
      return <input id={id} className="a-input" value={Array.isArray(value) ? value.join(', ') : ''} placeholder="comma, separated, tags" onChange={(e) => onChange(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />;
    case 'image': {
      const img = value as Img | null;
      return img?.url ? (
        <div className="img-field">
          <img src={thumb(img.url, 360, 220)} alt="" />
          <div className="img-field__meta">
            <input className="a-input" placeholder="Describe the image (alt text, for accessibility & SEO)" value={img.alt || ''} onChange={(e) => onChange({ ...img, alt: e.target.value })} />
            <input className="a-input" placeholder="Caption (optional)" value={img.caption || ''} onChange={(e) => onChange({ ...img, caption: e.target.value })} />
            <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => onChange(null)}><Icon name="trash" size={15} /> Remove</button>
          </div>
        </div>
      ) : (
        <Uploader folder={folder} accept="image/*" onDone={([r]) => r && onChange({ url: r.url, publicId: r.publicId, width: r.width, height: r.height, alt: '', caption: '' })}>
          <Icon name="upload" size={22} /><strong>Upload an image</strong><span>Drag & drop or click · JPG, PNG, WebP</span>
        </Uploader>
      );
    }
    case 'gallery': {
      const list = (Array.isArray(value) ? value : []) as Img[];
      const move = (i: number, d: number) => { const n = [...list]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x!); onChange(n); };
      return (
        <div className="gallery-field">
          {list.length > 0 && (
            <ul className="gallery-field__grid">
              {list.map((img, i) => (
                <li key={img.publicId || img.url}>
                  <img src={thumb(img.url, 240, 180)} alt="" />
                  <input className="a-input a-input--sm" placeholder="Caption" value={img.caption || ''} onChange={(e) => { const n = [...list]; n[i] = { ...img, caption: e.target.value, alt: img.alt || e.target.value }; onChange(n); }} />
                  <div className="gallery-field__tools">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move left"><Icon name="chevron-left" size={14} /></button>
                    <button type="button" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move right"><Icon name="chevron-right" size={14} /></button>
                    <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Uploader folder={folder} accept="image/*" multiple onDone={(rs) => onChange([...list, ...rs.map((r) => ({ url: r.url, publicId: r.publicId, width: r.width, height: r.height, alt: '', caption: '' }))])}>
            <Icon name="images" size={22} /><strong>Add photos</strong><span>Select or drop several images at once</span>
          </Uploader>
        </div>
      );
    }
    case 'file': {
      const f = value as FileRef | null;
      return f?.url ? (
        <div className="file-field">
          <Icon name="file" size={22} />
          <a href={f.url} target="_blank" rel="noreferrer">{f.name || f.url.split('/').pop()}</a>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => onChange(null)}>Replace</button>
        </div>
      ) : (
        <Uploader folder={folder} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" onDone={([r]) => r && onChange({ url: r.url, name: r.name, bytes: r.bytes, format: r.format, publicId: r.publicId })}>
          <Icon name="upload" size={22} /><strong>Upload a document</strong><span>PDF, Word, Excel, PowerPoint or image · up to 20 MB</span>
        </Uploader>
      );
    }
    default:
      return <input id={id} className="a-input" type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'} value={(value as string) || ''} maxLength={field.max} onChange={(e) => onChange(e.target.value)} />;
  }
}
