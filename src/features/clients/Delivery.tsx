import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBoot } from '../../app/boot';
import { Modal } from '../../components/overlay';
import { Empty, Field, Select } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { uid } from '../../lib/localState';
import { todayKey } from '../../lib/time';
import { leadName } from '../../lib/rules';
import { fDate } from '../../lib/format';
import { newChecklist, progress, projectStatus, toggle, type Project } from './onboarding';
import { useChecklists, useProjects } from './data';

/** Onboarding checklist for one client. Stored on this device. */
export function OnboardingPanel({ leadId }: { leadId: string }) {
  const { t, lang } = useI18n();
  const [all, setAll] = useChecklists();
  const items = all[leadId] || newChecklist(lang);
  const p = progress(items);
  const set = (next: typeof items) => setAll({ ...all, [leadId]: next });
  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <b className="num" style={{ fontSize: 22 }}>{p.pct}%</b>
        <div className="g-bar grow" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('تقدم التأهيل', 'Onboarding progress')}><i style={{ width: p.pct + '%' }} /></div>
        <span className="g-hint">{p.done}/{p.total}</span>
      </div>
      <div className="g-check">
        {items.map((it) => (
          <label key={it.id} className={it.done ? 'is-done' : ''}>
            <input type="checkbox" checked={it.done} onChange={() => set(toggle(items, it.id, todayKey()))} />
            <span>{it.title}{it.doneAt ? <small className="faint"> · {fDate(it.doneAt, lang)}</small> : null}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const STATUS: Record<Project['status'], [string, string, string]> = { planned: ['مخطط', 'Planned', ''], active: ['شغال', 'Active', 'tag--info'], review: ['مراجعة', 'In review', 'tag--warn'], delivered: ['اتسلم', 'Delivered', 'tag--good'] };

/** Projects and deliverables, for one client (leadId) or for everyone. */
export function ProjectsPanel({ leadId }: { leadId?: string }) {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const [all, setAll] = useProjects();
  const [adding, setAdding] = useState(false);
  const list = all.filter((p) => !leadId || p.leadId === leadId);
  const today = todayKey();
  const upd = (id: string, fn: (p: Project) => Project) => setAll(all.map((p) => (p.id === id ? fn(p) : p)));
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row"><span className="g-hint grow">{t('المشاريع والتسليمات محفوظة على جهازك.', 'Projects and deliverables are kept on this device.')}</span><button className="btn btn--sm btn--primary" onClick={() => setAdding(true)}><Icon name="plus" />{t('مشروع جديد', 'New project')}</button></div>
      {list.length ? list.map((p) => {
        const st = projectStatus(p); const pr = progress(p.deliverables); const lead = boot.leads.find((l) => l.id === p.leadId);
        return (
          <div key={p.id} className="g-cad">
            <div className="row wrap"><b className="grow">{p.name}{!leadId && lead ? <> · <Link to={'/clients/' + lead.id}>{leadName(lead)}</Link></> : null}</b><span className={'tag ' + STATUS[st][2]}>{t(STATUS[st][0], STATUS[st][1])}</span>{p.due ? <span className="g-hint">{t('التسليم ', 'Due ')}{fDate(p.due, lang)}</span> : null}</div>
            <div className="g-bar"><i style={{ width: pr.pct + '%' }} /></div>
            <div className="g-check">
              {p.deliverables.map((d) => (
                <label key={d.id} className={d.done ? 'is-done' : ''}>
                  <input type="checkbox" checked={d.done} onChange={() => upd(p.id, (x) => ({ ...x, deliverables: x.deliverables.map((y) => (y.id === d.id ? { ...y, done: !y.done } : y)) }))} />
                  <span>{d.title}{d.due ? <small className={!d.done && d.due < today ? 'band-at-risk' : 'faint'}> · {fDate(d.due, lang)}</small> : null}</span>
                </label>
              ))}
            </div>
            <div className="row">
              <button className="btn btn--sm btn--ghost" onClick={() => { const title = window.prompt(t('اسم التسليم', 'Deliverable name')); if (title) upd(p.id, (x) => ({ ...x, deliverables: [...x.deliverables, { id: uid(), title, due: '', done: false }] })); }}><Icon name="plus" />{t('تسليم', 'Deliverable')}</button>
              <button className="btn btn--sm btn--ghost" onClick={() => upd(p.id, (x) => ({ ...x, status: x.status === 'review' ? 'active' : 'review' }))}>{t('مراجعة', 'Review')}</button>
              <span className="grow" />
              <button className="btn btn--sm btn--ghost btn--danger" onClick={() => setAll(all.filter((x) => x.id !== p.id))} aria-label={t('احذف المشروع', 'Delete project')}><Icon name="trash" /></button>
            </div>
          </div>
        );
      }) : <Empty icon="board" title={t('مفيش مشاريع لسه', 'No projects yet')}>{t('ضيف مشروع بتسليماته عشان تتابع الشغل الجاري للعميل.', 'Add a project with deliverables to track the work in flight.')}</Empty>}
      {adding ? <NewProject leadId={leadId} onClose={() => setAdding(false)} onSave={(p) => { setAll([...all, p]); setAdding(false); }} /> : null}
    </div>
  );
}

function NewProject({ leadId, onClose, onSave }: { leadId?: string; onClose: () => void; onSave: (p: Project) => void }) {
  const { t } = useI18n();
  const boot = useBoot();
  const clients = boot.leads.filter((l) => l.stage === 'عميل نشط');
  const [lead, setLead] = useState(leadId || clients[0]?.id || '');
  const [name, setName] = useState('');
  const [due, setDue] = useState('');
  const [dels, setDels] = useState('');
  const [err, setErr] = useState('');
  const save = () => {
    if (!name.trim() || !lead) { setErr(t('اكتب اسم المشروع واختار العميل', 'Enter a name and choose the client')); return; }
    onSave({ id: uid(), leadId: lead, name: name.trim(), due, status: 'planned', deliverables: dels.split('\n').map((s) => s.trim()).filter(Boolean).map((title) => ({ id: uid(), title, due: '', done: false })) });
  };
  return (
    <Modal open onClose={onClose} title={t('مشروع جديد', 'New project')} onSubmit={save} footer={<><button className="btn btn--primary" onClick={save}>{t('احفظ', 'Save')}</button><button className="btn btn--ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</button></>}>
      {!leadId ? <Field label={t('العميل', 'Client')}><Select raw value={lead} onValue={setLead} options={clients.map((l) => [l.id, leadName(l)] as [string, string])} /></Field> : null}
      <Field label={t('اسم المشروع', 'Project name')} error={err}><input className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} placeholder={t('مثال: معرض 3D للفرع الجديد', 'e.g. 3D showroom for the new branch')} maxLength={120} /></Field>
      <Field label={t('ميعاد التسليم', 'Due date')}><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      <Field label={t('التسليمات (واحد في كل سطر)', 'Deliverables (one per line)')}><textarea className="textarea" rows={4} value={dels} onChange={(e) => setDels(e.target.value)} placeholder={t('تصوير المنتجات\nبناء الجولة\nمراجعة العميل', 'Product shots\nBuild the tour\nClient review')} /></Field>
    </Modal>
  );
}
