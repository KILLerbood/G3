import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import { useBoot } from '../../app/boot';
import { useActions } from '../../app/actions';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Empty, Field, Select } from '../../components/ui';
import { Modal, useToast } from '../../components/overlay';
import { Panel, Portrait } from '../../components/g3';
import { uid } from '../../lib/localState';
import { todayKey } from '../../lib/time';
import { leadName, fillTemplate } from '../../lib/rules';
import { fDate } from '../../lib/format';
import { refreshAfterWrite } from '../../api/queries';
import { waLink } from '../billing/render';
import { useEnrollments } from '../clients/data';
import { agenda, isFinished, mark, schedule, type Cadence, type Channel, type Enrollment } from './scheduler';
import { cadences, useAutoStop } from './hooks';

const CH: Record<Channel, [string, string, string]> = { wa: ['wa', 'واتساب', 'WhatsApp'], email: ['mail', 'إيميل', 'Email'], call: ['phone', 'مكالمة', 'Call'], task: ['tasks', 'مهمة', 'Task'] };
const KIND: Record<Channel, string> = { wa: 'واتساب', email: 'إيميل', call: 'مكالمة', task: 'ملاحظة' };

export function Sequences() {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const toast = useToast();
  const qc = useQueryClient();
  const { fail } = useActions();
  const enr = useAutoStop();
  const [, setEnr] = useEnrollments();
  const [adding, setAdding] = useState<string | null>(null);
  const today = todayKey();
  const due = agenda(enr, cadences, today);
  const lead = (id: string) => boot.leads.find((l) => l.id === id);
  const live = enr.filter((e) => !e.stopped && !isFinished(e, cadences.find((c) => c.id === e.cadenceId)!));
  const closed = enr.filter((e) => !live.includes(e));

  async function run(e: Enrollment, c: Cadence, index: number) {
    const l = lead(e.leadId); const step = c.steps[index];
    if (!l) return;
    const text = fillTemplate(step.body || step.title, l, boot);
    const win = step.channel === 'wa' ? window.open('about:blank', '_blank') : null;
    try {
      if (win) win.location.href = waLink(l.phone, text);
      if (step.channel === 'email') window.location.href = 'mailto:' + l.email + '?body=' + encodeURIComponent(text);
      await api.addActivity({ leadId: l.id, kind: KIND[step.channel], direction: 'صادر', summary: c.name + ' · ' + step.title, details: step.body ? text : '' });
      setEnr((all) => all.map((x) => (x.id === e.id ? mark(x, index, 'done') : x)));
      refreshAfterWrite(qc, l.id); qc.invalidateQueries({ queryKey: ['feed'] });
      toast(t('اتنفّذت الخطوة واتسجلت', 'Step done and logged'));
    } catch (x) { win?.close(); fail(x); }
  }
  const skip = (e: Enrollment, i: number) => setEnr((all) => all.map((x) => (x.id === e.id ? mark(x, i, 'skipped') : x)));

  return (
    <div>
      <div className="g-hero"><div style={{ flex: 1, minWidth: 240 }}><span className="g-eyebrow">{t('المتابعة', 'Follow-up')}</span><h1>{t('المتابعات المتسلسلة', 'Follow-up sequences')}</h1><p>{t('خطوات متوزعة على أيام الشغل (الجمعة والسبت إجازة). لو العميل رد، التسلسل بيقف لوحده.', 'Steps land on working days (Fri/Sat off). If the client replies, the sequence stops by itself.')}</p></div></div>
      <div className="g-cols">
        <div className="g-grid">
          <Panel title={t('مستحق النهارده', 'Due today')} id="seq-due" action={<span className="tag tag--acc">{due.length}</span>} flush>
            {due.length ? <div className="g-rows">{due.map((d) => {
              const l = lead(d.enrollment.leadId);
              return (
                <div key={d.enrollment.id} className="g-row">
                  <span className="g-chan"><Icon name={CH[d.step.channel][0]} /></span>
                  <div className="g-row__t"><b>{d.step.title}</b><small>{l ? <Link to={'/clients/' + l.id}>{leadName(l)}</Link> : '—'} · {d.cadence.name} · {d.state === 'overdue' ? t('متأخرة من ', 'late since ') + fDate(d.date, lang) : t('النهارده', 'today')}</small></div>
                  <button className="btn btn--sm btn--primary" onClick={() => run(d.enrollment, d.cadence, d.index)}>{t('نفّذ', 'Do it')}</button>
                  <button className="btn btn--sm btn--ghost" onClick={() => skip(d.enrollment, d.index)}>{t('تخطّي', 'Skip')}</button>
                </div>
              );
            })}</div> : <Empty icon="check" title={t('مفيش خطوات مستحقة', 'No steps due')}>{t('سجّل عميل في تسلسل من القوالب اللي على الجنب.', 'Enrol a client from the templates on the side.')}</Empty>}
          </Panel>
          <Panel title={t('التسلسلات الشغالة', 'Running sequences')} flush>
            {live.length ? <div className="g-rows">{live.map((e) => {
              const c = cadences.find((x) => x.id === e.cadenceId)!; const l = lead(e.leadId); const sch = schedule(e, c, today);
              return (
                <div key={e.id} className="g-row">
                  {l ? <Portrait name={leadName(l)} size={36} /> : null}
                  <div className="g-row__t"><b>{l ? leadName(l) : '—'}</b><small>{c.name} · {t('بدأ ', 'started ')}{fDate(e.start, lang)}</small></div>
                  <div className="g-steps" role="img" aria-label={sch.map((s) => s.state).join(', ')}>{sch.map((s) => <i key={s.index} className={s.state} />)}</div>
                  <button className="ibtn ibtn--sm" aria-label={t('أوقف التسلسل', 'Stop sequence')} onClick={() => setEnr((all) => all.map((x) => (x.id === e.id ? { ...x, stopped: today, stopReason: 'manual' } : x)))}><Icon name="pause" /></button>
                </div>
              );
            })}</div> : <Empty icon="refresh" title={t('مفيش تسلسلات شغالة', 'No running sequences')} />}
          </Panel>
          {closed.length ? (
            <Panel title={t('خلصت أو وقفت', 'Finished or stopped')} flush>
              <div className="g-rows">{closed.map((e) => { const l = lead(e.leadId); const c = cadences.find((x) => x.id === e.cadenceId); return (
                <div key={e.id} className="g-row"><div className="g-row__t"><b>{l ? leadName(l) : '—'}</b><small>{c?.name}</small></div>{e.stopped ? <span className={'tag ' + (e.stopReason === 'reply' ? 'tag--good' : '')}>{e.stopReason === 'reply' ? t('وقف: العميل رد', 'Stopped: client replied') : t('اتوقف', 'Stopped')}</span> : <span className="tag tag--good">{t('خلص', 'Done')}</span>}</div>
              ); })}</div>
            </Panel>
          ) : null}
        </div>
        <aside className="g-grid">
          {cadences.map((c) => (
            <section key={c.id} className="g-cad" aria-label={c.name}>
              <div className="row"><b className="grow">{c.name}</b><span className="tag">{c.audience === 'lead' ? t('محتمل', 'Lead') : t('عميل', 'Client')}</span></div>
              <ol>{c.steps.map((s, i) => <li key={i}><span className="num">{t('يوم ', 'Day ')}{s.day}</span><span className="g-chan" style={{ width: 24, height: 24 }}><Icon name={CH[s.channel][0]} /></span><span>{s.title}</span></li>)}</ol>
              <button className="btn btn--sm" onClick={() => setAdding(c.id)}><Icon name="plus" />{t('سجّل عميل', 'Enrol a client')}</button>
            </section>
          ))}
        </aside>
      </div>
      {adding ? <Enrol cadenceId={adding} onClose={() => setAdding(null)} onSave={(e) => { setEnr((all) => [...all, e]); setAdding(null); toast(t('اتسجل في التسلسل', 'Enrolled')); }} /> : null}
    </div>
  );
}

function Enrol({ cadenceId, onClose, onSave }: { cadenceId: string; onClose: () => void; onSave: (e: Enrollment) => void }) {
  const { t } = useI18n();
  const boot = useBoot();
  const c = cadences.find((x) => x.id === cadenceId)!;
  const pool = boot.leads.filter((l) => (c.audience === 'client' ? ['عميل نشط', 'متوقف'].includes(l.stage) : !['خسرناه', 'عميل نشط', 'متوقف'].includes(l.stage)));
  const [leadId, setLeadId] = useState(pool[0]?.id || '');
  const [start, setStart] = useState(todayKey());
  return (
    <Modal open onClose={onClose} title={t('سجّل في: ', 'Enrol in: ') + c.name} onSubmit={() => leadId && onSave({ id: uid(), cadenceId, leadId, start, done: [], skipped: [] })}
      footer={<><button className="btn btn--primary" disabled={!leadId} onClick={() => onSave({ id: uid(), cadenceId, leadId, start, done: [], skipped: [] })}>{t('ابدأ', 'Start')}</button><button className="btn btn--ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</button></>}>
      <Field label={t('العميل', 'Client')}><Select raw value={leadId} onValue={setLeadId} options={pool.map((l) => [l.id, leadName(l)] as [string, string])} /></Field>
      <Field label={t('تاريخ البداية', 'Start date')}><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
    </Modal>
  );
}
