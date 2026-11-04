import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import { upsertLead, refreshAfterWrite, useLead } from '../../api/queries';
import type { Billing, Lead, LeadDetail } from '../../api/schemas';
import { useBoot } from '../../app/boot';
import { useActions } from '../../app/actions';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Empty, QueryState, Select, Field, StagePill } from '../../components/ui';
import { Modal, useToast } from '../../components/overlay';
import { Panel, Portrait, StrengthBadge } from '../../components/g3';
import { leadName } from '../../lib/rules';
import { ago, fDateY, fDT, fTime, fDateLong, initials, phoneKey } from '../../lib/format';
import { rememberLead } from '../../lib/recent';
import { uid } from '../../lib/localState';
import { todayKey } from '../../lib/time';
import { companyKey } from '../../lib/rules';
import { BillingTab, billingKey } from '../billing/BillingTab';
import { ReminderModal } from '../billing/ReminderModal';
import { dealFlow, FLOW_LABEL, daysOverdue } from '../billing/flow';
import { money } from '../billing/render';
import { cadences } from '../cadence/hooks';
import { BAND_LABEL, FACTOR_LABEL, relationshipStrength } from './strength';
import { buildTimeline, filterTimeline, groupByDay, type TLKind } from './timeline';
import { findMentions, insertMention, mentionQuery, splitMentions } from './mentions';
import { OnboardingPanel, ProjectsPanel } from './Delivery';
import { ROLE_LABEL, useAccountContacts, useContracts, useEnrollments, useNotes, type AccountContact } from './data';

const TL_ICON: Record<TLKind, string> = { call: 'phone', whatsapp: 'wa', email: 'mail', meeting: 'video', note: 'note', stage: 'stage', quote: 'doc', invoice: 'doc', payment: 'check', system: 'bolt' };
type Tab = 'timeline' | 'money' | 'people' | 'delivery';

export function Client360() {
  const { id = '' } = useParams();
  const q = useLead(id);
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <QueryState q={q} skeleton={<div className="stack" style={{ gap: 16 }}><div className="skel" style={{ height: 130, borderRadius: 18 }} /><div className="skel" style={{ height: 380, borderRadius: 16 }} /></div>}>
      {q.data ? <Body det={q.data} /> : <Empty title={t('العميل مش موجود', 'Client not found')} action={<button className="btn" onClick={() => nav('/clients')}>{t('رجوع للعملاء', 'Back to clients')}</button>} />}
    </QueryState>
  );
}

function Body({ det }: { det: LeadDetail }) {
  const { t, lang, v } = useI18n();
  const actions = useActions();
  const [sp, setSp] = useSearchParams();
  const lead = det.lead;
  const tab = (['timeline', 'money', 'people', 'delivery'].includes(sp.get('tab') || '') ? sp.get('tab') : 'timeline') as Tab;
  const setTab = (x: Tab) => setSp((p) => { const n = new URLSearchParams(p); n.set('tab', x); return n; }, { replace: true });
  rememberLead(lead.id);
  const bq = useQuery({ queryKey: billingKey(lead.id), queryFn: () => api.billing({ leadId: lead.id }) });
  const [notes] = useNotes();
  const [quick, setQuick] = useState<null | { kind: string }>(null);
  const [remind, setRemind] = useState<null | Billing['invoices'][number]>(null);
  const [filter, setFilter] = useState('all');
  const billing = bq.data;
  const myNotes = notes.filter((n) => n.leadId === lead.id);

  const strength = useMemo(() => relationshipStrength({ now: Date.now(), stage: lead.stage, lastContact: lead.lastContact, activities: det.activities, bookings: det.bookings, invoices: billing?.invoices || [] }), [lead, det, billing]);
  const timeline = useMemo(() => buildTimeline({
    activities: det.activities, bookings: det.bookings.filter((b) => Date.parse(b.startIso) <= Date.now() + 7 * 864e5),
    quotes: billing?.quotes, invoices: billing?.invoices, payments: billing?.payments,
    notes: myNotes.map((n) => ({ id: n.id, at: n.at, by: n.by, text: n.text }))
  }), [det, billing, myNotes]);
  const groups = useMemo(() => groupByDay(filterTimeline(timeline, filter)), [timeline, filter]);
  const owner = lead.owner || t('بدون مسؤول', 'Unassigned');
  const hasMoney = (billing?.invoices.length || 0) > 0;
  const openBal = (billing?.invoices || []).filter((i) => ['اتبعت', 'مدفوعة جزئيًا'].includes(i.status)).reduce((a, i) => a + (i.balance || 0), 0);

  return (
    <div>
      <nav aria-label={t('مسار الصفحة', 'Breadcrumb')} className="g-hint" style={{ margin: '4px 0 10px' }}><Link to="/clients">{t('العملاء', 'Clients')}</Link> / {leadName(lead)}</nav>
      <header className="g-c360">
        <Portrait name={leadName(lead)} size={84} score={strength.score} band={strength.band} />
        <div style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}><StagePill stage={lead.stage} /><StrengthBadge score={strength.score} band={strength.band} /></div>
          <h1>{leadName(lead)}</h1>
          <div className="g-c360__meta">
            <span><Icon name="user" />{lead.name}</span>
            {lead.city ? <span><Icon name="pin" />{lead.city}</span> : null}
            {lead.phone ? <a className="ltr" href={'tel:' + lead.phone}><Icon name="phone" />{lead.phone}</a> : null}
            {lead.mrr ? <span><Icon name="chart" /><b className="num">{money(lead.mrr, billing?.settings.currency || 'SAR').replace('.00', '')}</b> / {t('شهر', 'mo')}</span> : null}
            <span><Icon name="users" />{owner}</span>
            {lead.renewal ? <span><Icon name="calendar" />{t('تجديد ', 'Renews ')}{fDateY(lead.renewal, lang)}</span> : null}
          </div>
        </div>
        <div className="g-oneTap" role="group" aria-label={t('تسجيل سريع', 'Quick log')}>
          <button className="g-tap g-tap--call" onClick={() => setQuick({ kind: 'مكالمة' })}><Icon name="phone" />{t('مكالمة', 'Call')}</button>
          <button className="g-tap g-tap--wa" onClick={() => actions.compose(lead, 'واتساب')}><Icon name="wa" />{t('واتساب', 'WhatsApp')}</button>
          <button className="g-tap g-tap--meet" onClick={() => setQuick({ kind: 'اجتماع' })}><Icon name="video" />{t('اجتماع', 'Meeting')}</button>
          <button className="g-tap g-tap--mail" onClick={() => actions.compose(lead, 'إيميل')}><Icon name="mail" />{t('إيميل', 'Email')}</button>
          <button className="g-tap g-tap--note" onClick={() => { setTab('timeline'); setTimeout(() => document.getElementById('g-note')?.focus(), 50); }}><Icon name="note" />{t('ملاحظة', 'Note')}</button>
        </div>
      </header>

      <div className="g-tabs" role="tablist" aria-label={t('أقسام العميل', 'Client sections')}>
        {([['timeline', t('الخط الزمني', 'Timeline'), timeline.length], ['money', t('الفلوس', 'Money'), billing?.invoices.length || 0], ['people', t('الناس', 'People'), 0], ['delivery', t('التأهيل والمشاريع', 'Onboarding & projects'), 0]] as [Tab, string, number][]).map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}{n ? <span className="n">{n}</span> : null}</button>
        ))}
        <span className="grow" />
        <Link className="btn btn--sm btn--ghost" to={'/leads/' + lead.id}><Icon name="edit" />{t('تعديل البيانات', 'Edit details')}</Link>
      </div>

      {tab === 'timeline' && (
        <div className="g-cols">
          <div className="g-grid">
            <Notes lead={lead} />
            <Panel title={t('كل اللي حصل', 'Everything that happened')} id="tl-h" action={
              <div className="chips" role="group" aria-label={t('فلتر الخط الزمني', 'Timeline filter')}>
                {([['all', t('الكل', 'All')], ['talk', t('تواصل', 'Contact')], ['money', t('فلوس', 'Money')], ['notes', t('ملاحظات', 'Notes')], ['stage', t('مراحل', 'Stages')]] as const).map(([k, l]) => <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
              </div>}>
              {groups.length ? (
                <div className="g-tl">
                  {groups.map((g) => (
                    <div key={g.day} style={{ display: 'contents' }}>
                      <div className="g-tl__day">{fDateLong(g.day + 'T12:00:00+03:00', lang)}</div>
                      {g.items.map((it) => (
                        <div key={it.id} className="g-tl__item">
                          <span className={'g-tl__ic g-tl__ic--' + it.kind} aria-hidden="true"><Icon name={TL_ICON[it.kind]} /></span>
                          <div className={'g-tl__box' + (it.inbound && it.kind !== 'payment' ? ' g-tl__box--in' : '')}>
                            <div className="row" style={{ alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {it.kind === 'note' ? <MentionText text={it.title} /> : <b>{it.title}</b>}
                                {it.body ? <p>{it.body}</p> : null}
                              </div>
                              {it.amount != null ? <span className="g-tl__amt">{money(it.amount, it.currency).replace('.00', '')}</span> : null}
                            </div>
                            <div className="g-tl__meta"><span>{fTime(it.at, lang)}</span>{it.by ? <span>{it.by}</span> : null}{it.inbound && it.kind !== 'payment' ? <span className="tag tag--acc">{t('وارد منه', 'From them')}</span> : null}<span className="faint">{TL_LABEL(it.kind, t)}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : <Empty icon="history" title={t('مفيش حاجة هنا', 'Nothing here')}>{t('أول مكالمة أو رسالة هتظهر هنا.', 'The first call or message will show up here.')}</Empty>}
            </Panel>
          </div>
          <aside className="g-grid">
            <Panel title={t('قوة العلاقة', 'Relationship strength')}>
              <div className="row" style={{ gap: 14, marginBottom: 12 }}>
                <b className={'num band-' + strength.band} style={{ fontSize: 44, lineHeight: 1 }}>{strength.score}</b>
                <div><b className={'band-' + strength.band}>{t(BAND_LABEL[strength.band][0], BAND_LABEL[strength.band][1])}</b><div className="g-hint">{strength.lastTouch ? t('آخر تواصل ', 'Last touch ') + ago(new Date(strength.lastTouch).toISOString(), lang) : t('مفيش تواصل مسجل', 'No contact logged')}</div></div>
              </div>
              <div className="stack" style={{ gap: 9 }}>
                {strength.factors.map((f) => (
                  <div key={f.key}><div className="row" style={{ fontSize: 12.5 }}><span className="grow">{t(FACTOR_LABEL[f.key][0], FACTOR_LABEL[f.key][1])}</span><b className="num">{f.points}/{f.max}</b></div><div className="g-bar" aria-hidden="true"><i style={{ width: (f.points / f.max) * 100 + '%' }} /></div></div>
                ))}
              </div>
            </Panel>
            <Panel title={t('الخطوة الجاية', 'Next step')}>
              <NextSteps lead={lead} det={det} hasMoney={hasMoney} openBal={openBal} cur={billing?.settings.currency || 'SAR'} onMoney={() => setTab('money')} />
            </Panel>
            <Panel title={t('تسلسل متابعة', 'Follow-up sequence')}><EnrolBox lead={lead} /></Panel>
          </aside>
        </div>
      )}

      {tab === 'money' && (
        <div className="g-grid">
          {billing ? <MoneyFlow det={det} billing={billing} onRemind={(i) => setRemind(i)} /> : null}
          <BillingTab det={det} />
        </div>
      )}
      {tab === 'people' && <PeopleMap lead={lead} />}
      {tab === 'delivery' && (
        <div className="g-cols g-cols--even">
          <Panel title={t('قائمة التأهيل', 'Onboarding checklist')}><OnboardingPanel leadId={lead.id} /></Panel>
          <Panel title={t('المشاريع والتسليمات', 'Projects & deliverables')}><ProjectsPanel leadId={lead.id} /></Panel>
        </div>
      )}

      {quick ? <QuickLog lead={lead} kind={quick.kind} onClose={() => setQuick(null)} /> : null}
      {remind ? <ReminderModal inv={remind} lead={lead} onClose={() => setRemind(null)} /> : null}
      <span className="sr-only">{v(lead.stage)}</span>
    </div>
  );
}

const TL_LABEL = (k: TLKind, t: (a: string, e: string) => string) => ({ call: t('مكالمة', 'Call'), whatsapp: t('واتساب', 'WhatsApp'), email: t('إيميل', 'Email'), meeting: t('اجتماع', 'Meeting'), note: t('ملاحظة', 'Note'), stage: t('مرحلة', 'Stage'), quote: t('عرض سعر', 'Quote'), invoice: t('فاتورة', 'Invoice'), payment: t('دفعة', 'Payment'), system: t('النظام', 'System') })[k];

function MentionText({ text }: { text: string }) {
  const boot = useBoot();
  const parts = splitMentions(text, boot.team.map((m) => m.name));
  return <b style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{parts.map((p, i) => (p.mention ? <span key={i} className="g-mention">{p.v}</span> : <span key={i}>{p.v}</span>))}</b>;
}

/** Notes with @mentions: type @ to pick a colleague; they get a direct message with the note. */
function Notes({ lead }: { lead: Lead }) {
  const { t } = useI18n();
  const boot = useBoot();
  const toast = useToast();
  const [notes, setNotes] = useNotes();
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const names = boot.team.map((m) => m.name);
  const query = mentionQuery(text, caret);
  const options = query == null ? [] : boot.team.filter((m) => m.name.includes(query) && m.name !== boot.me.name).slice(0, 5);
  const pick = (name: string) => { const r = insertMention(text, caret, name); setText(r.text); setCaret(r.caret); setTimeout(() => { ref.current?.focus(); ref.current?.setSelectionRange(r.caret, r.caret); }, 0); };
  async function save() {
    const body = text.trim();
    if (!body) return;
    const mentions = findMentions(body, names);
    setNotes([{ id: uid(), leadId: lead.id, at: new Date().toISOString(), by: boot.me.name, text: body, mentions }, ...notes]);
    setText('');
    for (const n of mentions) {
      const m = boot.team.find((x) => x.name === n);
      if (m && m.email !== boot.me.email) { try { await api.sendMessage({ to: m.email, body: '@' + n + ' ملاحظة على ' + leadName(lead) + ': ' + body }); } catch { /* the note is saved either way */ } }
    }
    toast(mentions.length ? t('اتحفظت واتبعت للمذكورين', 'Saved and sent to the people mentioned') : t('اتحفظت الملاحظة', 'Note saved'));
  }
  return (
    <section className="g-panel">
      <div className="g-panel__body">
        <div className="g-composer">
          <label className="sr-only" htmlFor="g-note">{t('ملاحظة جديدة', 'New note')}</label>
          <textarea id="g-note" ref={ref} className="textarea" rows={3} value={text} placeholder={t('اكتب ملاحظة… استخدم @ لمنشن زميل', 'Write a note… use @ to mention a colleague')}
            onChange={(e) => { setText(e.target.value); setCaret(e.target.selectionStart); setSel(0); }}
            onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)} onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
            onKeyDown={(e) => {
              if (options.length) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % options.length); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel + options.length - 1) % options.length); }
                else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(options[sel].name); } else if (e.key === 'Escape') { e.stopPropagation(); setCaret(0); }
              } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
            }} />
          {options.length ? (
            <div className="g-suggest" role="listbox" aria-label={t('زملاء', 'Colleagues')}>
              {options.map((m, i) => <button key={m.email} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); pick(m.name); }}><span className="av">{initials(m.name)}</span>{m.name}<small className="faint"> {m.role}</small></button>)}
            </div>
          ) : null}
        </div>
        <div className="row" style={{ marginTop: 8 }}><span className="g-hint grow">Ctrl + Enter</span><button className="btn btn--sm btn--primary" onClick={save} disabled={!text.trim()}>{t('احفظ الملاحظة', 'Save note')}</button></div>
      </div>
    </section>
  );
}

function QuickLog({ lead, kind, onClose }: { lead: Lead; kind: string; onClose: () => void }) {
  const { t, v } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const { fail } = useActions();
  const [dir, setDir] = useState(kind === 'اجتماع' ? 'داخلي' : 'صادر');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const presets = kind === 'مكالمة' ? [t('كلمته واتفقنا على الخطوة الجاية', 'Called, agreed next step'), t('مردش، هحاول تاني', 'No answer, will retry'), t('كلمني وسأل عن السعر', 'They called asking about price')] : [t('اجتماع تعريفي وعرضنا الخدمات', 'Intro meeting, presented services'), t('اجتماع متابعة الأداء', 'Performance review meeting'), t('اجتماع تجديد', 'Renewal meeting')];
  async function save() {
    const s = summary.trim() || presets[0];
    setBusy(true);
    try {
      const r = await api.addActivity({ leadId: lead.id, kind, direction: dir, summary: s, details: '' });
      upsertLead(qc, r.lead);
      refreshAfterWrite(qc, lead.id);
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast(t('اتسجل ', 'Logged ') + v(kind));
      onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={t('سجّل ', 'Log ') + v(kind) + ' · ' + leadName(lead)} onSubmit={save} footer={<><button className="btn btn--primary" disabled={busy} onClick={save}>{t('سجّل', 'Log it')}</button><button className="btn btn--ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</button></>}>
      <div className="chips">{presets.map((p) => <button key={p} className="chip" onClick={() => setSummary(p)}>{p}</button>)}</div>
      <Field label={t('الملخص', 'Summary')}><input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} placeholder={presets[0]} /></Field>
      <Field label={t('مين بدأ', 'Who started')}><Select raw value={dir} onValue={setDir} options={[['صادر', t('إحنا بدأنا', 'We reached out')], ['وارد', t('هو بدأ', 'They reached out')], ['داخلي', t('داخلي', 'Internal')]]} /></Field>
    </Modal>
  );
}

function NextSteps({ lead, det, hasMoney, openBal, cur, onMoney }: { lead: Lead; det: LeadDetail; hasMoney: boolean; openBal: number; cur: string; onMoney: () => void }) {
  const { t, lang } = useI18n();
  const actions = useActions();
  const tasks = det.tasks.filter((x) => x.status === 'مفتوحة');
  const nextMeet = det.bookings.filter((b) => b.status === 'مؤكد' && Date.parse(b.startIso) > Date.now()).sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))[0];
  return (
    <div className="stack" style={{ gap: 10 }}>
      {nextMeet ? <div className="row"><span className="g-chan"><Icon name="video" /></span><div className="g-row__t"><b>{nextMeet.meetingType}</b><small>{fDT(nextMeet.startIso, lang)}</small></div></div> : null}
      {tasks.slice(0, 3).map((x) => <div key={x.id} className="row"><span className="g-chan"><Icon name="tasks" /></span><div className="g-row__t"><b>{x.task}</b><small>{fDT(x.due, lang)}</small></div></div>)}
      {openBal > 0 ? <button className="btn btn--sm" onClick={onMoney}><Icon name="doc" />{t('مستحق ', 'Outstanding ')}{money(openBal, cur).replace('.00', '')}</button> : hasMoney ? null : <button className="btn btn--sm" onClick={onMoney}><Icon name="plus" />{t('اعمل عرض سعر', 'Make a quote')}</button>}
      <button className="btn btn--sm" onClick={() => actions.newTask(lead)}><Icon name="plus" />{t('مهمة جديدة', 'New task')}</button>
      {!nextMeet && !tasks.length ? <p className="g-hint" style={{ margin: 0 }}>{t('مفيش خطوة مجدولة. حدد مهمة أو اجتماع عشان العلاقة ما تبردش.', 'Nothing scheduled. Set a task or a meeting so the relationship doesn’t cool.')}</p> : null}
    </div>
  );
}

function EnrolBox({ lead }: { lead: Lead }) {
  const { t } = useI18n();
  const toast = useToast();
  const [enr, setEnr] = useEnrollments();
  const mine = enr.filter((e) => e.leadId === lead.id && !e.stopped);
  const [cid, setCid] = useState(cadences[0].id);
  return (
    <div className="stack" style={{ gap: 10 }}>
      {mine.map((e) => <div key={e.id} className="row"><span className="tag tag--good">{cadences.find((c) => c.id === e.cadenceId)?.name}</span><span className="grow" /><Link to="/sequences" className="btn btn--sm btn--ghost">{t('افتح', 'Open')}</Link></div>)}
      <Select raw value={cid} onValue={setCid} options={cadences.map((c) => [c.id, c.name] as [string, string])} aria-label={t('اختار التسلسل', 'Choose a sequence')} />
      <button className="btn btn--sm btn--primary" onClick={() => { setEnr([...enr, { id: uid(), cadenceId: cid, leadId: lead.id, start: todayKey(), done: [], skipped: [] }]); toast(t('اتسجل في التسلسل', 'Enrolled')); }}><Icon name="refresh" />{t('ابدأ التسلسل النهارده', 'Start it today')}</button>
    </div>
  );
}

/** Quote → contract → invoice → payment for this client, with the contract kept on this device. */
function MoneyFlow({ det, billing, onRemind }: { det: LeadDetail; billing: Billing; onRemind: (i: Billing['invoices'][number]) => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [contracts, setContracts] = useContracts();
  const lead = det.lead;
  const quotes = billing.quotes;
  const q = quotes.find((x) => x.status === 'اتوافق عليه') || quotes.find((x) => ['اتفتح', 'اتبعت', 'مسودة'].includes(x.status)) || quotes[0] || null;
  const contract = q ? contracts.find((c) => c.quoteId === q.id) || null : null;
  const flow = dealFlow(q, contract, billing.invoices);
  const late = billing.invoices.filter((i) => i.overdue);
  const setContract = (patch: Partial<NonNullable<typeof contract>>) => {
    if (!q) return;
    if (contract) setContracts(contracts.map((c) => (c.id === contract.id ? { ...c, ...patch } : c)));
    else setContracts([...contracts, { id: 'CT-' + q.id.slice(2), quoteId: q.id, leadId: lead.id, status: 'draft', startDate: todayKey(), months: 12, ...patch }]);
  };
  return (
    <Panel title={t('مسار الفلوس', 'Money path')}>
      <div className="g-flow" role="list" aria-label={t('مراحل الصفقة', 'Deal stages')}>
        {flow.steps.map((s) => (
          <div key={s.key} role="listitem" className={'g-flow__step is-' + s.state}>
            <b>{t(FLOW_LABEL[s.key][0], FLOW_LABEL[s.key][1])}</b>
            <small>{s.key === 'quote' ? (q ? q.id + ' · ' + q.status : t('مفيش عرض', 'No quote')) : s.key === 'contract' ? (contract ? { draft: t('مسودة', 'Draft'), sent: t('اتبعت للتوقيع', 'Sent to sign'), signed: t('اتمضى', 'Signed') }[contract.status] : t('لسه', 'Not yet')) : s.key === 'invoice' ? billing.invoices.filter((i) => i.status !== 'ملغية').length + t(' فاتورة', ' invoices') : t('متحصّل ', 'Collected ') + money(billing.payments.reduce((a, p) => a + p.amount, 0), billing.settings.currency).replace('.00', '')}</small>
          </div>
        ))}
      </div>
      {q && q.status === 'اتوافق عليه' ? (
        <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
          <b>{t('العقد ', 'Contract ')}{contract?.id || ''}</b>
          {contract?.status === 'signed' ? <span className="tag tag--good">{t('اتمضى ', 'Signed ')}{contract.signedAt ? fDateY(contract.signedAt, lang) : ''}</span> : (
            <>
              {!contract ? <button className="btn btn--sm" onClick={() => setContract({})}>{t('جهّز العقد', 'Prepare contract')}</button> : null}
              {contract?.status === 'draft' ? <button className="btn btn--sm" onClick={() => { setContract({ status: 'sent' }); toast(t('العقد جاهز للتوقيع', 'Contract ready to sign')); }}>{t('ابعته للتوقيع', 'Send for signature')}</button> : null}
              {contract ? <button className="btn btn--sm btn--primary" onClick={() => { setContract({ status: 'signed', signedAt: new Date().toISOString(), signer: lead.name }); toast(t('اتسجل التوقيع', 'Signature recorded')); }}>{t('سجّل إنه اتمضى', 'Mark as signed')}</button> : null}
            </>
          )}
          {contract ? <span className="g-hint">{t('مدة ', 'Term ')}{contract.months}{t(' شهر من ', ' months from ')}{contract.startDate}</span> : null}
        </div>
      ) : null}
      {late.length ? (
        <div className="stack" style={{ marginTop: 16, gap: 8 }}>
          {late.map((i) => (
            <div key={i.id} className="row wrap" style={{ padding: '8px 12px', background: 'var(--bad-soft)', borderRadius: 10 }}>
              <Icon name="alert" /><b>{i.id}</b><span>{money(i.balance, i.currency).replace('.00', '')}</span><span className="band-at-risk">{t(`متأخرة ${daysOverdue(i.dueDate, Date.now())} يوم`, `${daysOverdue(i.dueDate, Date.now())} days late`)}</span><span className="grow" />
              <button className="btn btn--sm btn--primary" onClick={() => onRemind(i)}><Icon name="wa" />{t('ابعت تذكير', 'Send reminder')}</button>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

/** The account's people: this client's contacts, other branches/leads of the same company, and people added here. */
function PeopleMap({ lead }: { lead: Lead }) {
  const { t } = useI18n();
  const boot = useBoot();
  const nav = useNavigate();
  const [extra, setExtra] = useAccountContacts();
  const [adding, setAdding] = useState(false);
  const key = companyKey(lead.business || lead.name);
  const siblings = boot.leads.filter((l) => l.id !== lead.id && l.business && companyKey(l.business) === key && phoneKey(l.phone) !== phoneKey(lead.phone));
  const mine = extra.filter((c) => c.leadId === lead.id);
  const people: (AccountContact & { go?: string })[] = [
    { id: 'main', leadId: lead.id, name: lead.name, title: t('جهة الاتصال الأساسية', 'Primary contact'), role: 'decider', phone: lead.phone, email: lead.email },
    ...siblings.map((l) => ({ id: l.id, leadId: lead.id, name: l.name, title: l.business, role: 'user' as const, phone: l.phone, email: l.email, go: '/clients/' + l.id })),
    ...mine
  ];
  const cx = 50, cy = 50;
  const pos = people.map((_, i) => { const a = (-90 + (360 / people.length) * i) * (Math.PI / 180); return [cx + 36 * Math.cos(a) * (people.length === 1 ? 0 : 1) + (people.length === 1 ? 0 : 0), cy + 34 * Math.sin(a) + (people.length === 1 ? 34 : 0)] as const; });
  return (
    <div className="g-cols">
      <Panel title={t('خريطة الناس في ', 'People map · ') + leadName(lead)} action={<button className="btn btn--sm btn--primary" onClick={() => setAdding(true)}><Icon name="userplus" />{t('ضيف شخص', 'Add person')}</button>}>
        <div className="g-map" role="group" aria-label={t('خريطة جهات الاتصال', 'Contacts map')}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{pos.map(([x, y], i) => <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-2)" strokeWidth="0.4" strokeDasharray="1.2 1.2" vectorEffect="non-scaling-stroke" />)}</svg>
          <div className="g-map__node g-map__node--center" style={{ left: cx + '%', top: cy + '%' }}><Portrait name={leadName(lead)} size={64} /><b>{leadName(lead)}</b><small>{t('الحساب', 'Account')}</small></div>
          {people.map((p, i) => (
            <div key={p.id} className="g-map__node" style={{ left: pos[i][0] + '%', top: pos[i][1] + '%' }}>
              <button onClick={() => (p.go ? nav(p.go) : undefined)} aria-label={p.name + ' · ' + t(ROLE_LABEL[p.role][0], ROLE_LABEL[p.role][1])}>
                <Portrait name={p.name} size={46} /><b>{p.name}</b><span className={'g-role g-role--' + p.role}>{t(ROLE_LABEL[p.role][0], ROLE_LABEL[p.role][1])}</span>
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title={t('التفاصيل', 'Details')} flush>
        <div className="g-rows">
          {people.map((p) => (
            <div key={p.id} className="g-row">
              <Portrait name={p.name} size={38} />
              <div className="g-row__t"><b>{p.name}</b><small>{p.title}</small></div>
              <div className="row" style={{ gap: 4 }}>
                {p.phone ? <a className="ibtn ibtn--sm" href={'tel:' + p.phone} aria-label={t('اتصل بـ ', 'Call ') + p.name}><Icon name="phone" /></a> : null}
                {p.email ? <a className="ibtn ibtn--sm" href={'mailto:' + p.email} aria-label={t('إيميل لـ ', 'Email ') + p.name}><Icon name="mail" /></a> : null}
                {extra.some((c) => c.id === p.id) ? <button className="ibtn ibtn--sm" aria-label={t('احذف', 'Remove')} onClick={() => setExtra(extra.filter((c) => c.id !== p.id))}><Icon name="trash" /></button> : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      {adding ? <AddPerson lead={lead} onClose={() => setAdding(false)} onSave={(c) => { setExtra([...extra, c]); setAdding(false); }} /> : null}
    </div>
  );
}

function AddPerson({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (c: AccountContact) => void }) {
  const { t } = useI18n();
  const [f, setF] = useState<AccountContact>({ id: uid(), leadId: lead.id, name: '', title: '', role: 'champion', phone: '', email: '' });
  const [err, setErr] = useState('');
  const save = () => { if (!f.name.trim()) { setErr(t('اكتب الاسم', 'Enter a name')); return; } onSave(f); };
  return (
    <Modal open onClose={onClose} title={t('شخص جديد في الحساب', 'New person on the account')} onSubmit={save} footer={<><button className="btn btn--primary" onClick={save}>{t('احفظ', 'Save')}</button><button className="btn btn--ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</button></>}>
      <Field label={t('الاسم', 'Name')} error={err}><input className="input" value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(''); }} /></Field>
      <div className="fields">
        <Field label={t('الوظيفة', 'Title')}><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={t('دوره', 'Role')}><Select raw value={f.role} onValue={(v) => setF({ ...f, role: v as AccountContact['role'] })} options={(Object.keys(ROLE_LABEL) as AccountContact['role'][]).map((k) => [k, t(ROLE_LABEL[k][0], ROLE_LABEL[k][1])] as [string, string])} /></Field>
        <Field label={t('الجوال', 'Phone')}><input className="input ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label={t('الإيميل', 'Email')}><input className="input ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
