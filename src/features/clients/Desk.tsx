import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBoot } from '../../app/boot';
import { useActions } from '../../app/actions';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Empty, Skel } from '../../components/ui';
import { Ledger, Panel, Portrait, StrengthBadge } from '../../components/g3';
import { leadName, isLate } from '../../lib/rules';
import { ago, fDT, money as fm } from '../../lib/format';
import { todayKey } from '../../lib/time';
import { useAllBilling, useRecentActivity, useStrengths } from './data';
import { portfolioStats } from '../portfolio/metrics';
import { aging, daysOverdue } from '../billing/flow';
import { agenda } from '../cadence/scheduler';
import { cadences, useAutoStop } from '../cadence/hooks';
import { money } from '../billing/render';

/** Home: today's desk. What needs you now, in the order of what hurts most if it waits. */
export function Desk() {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const actions = useActions();
  const nav = useNavigate();
  const billing = useAllBilling();
  const feed = useRecentActivity();
  const enr = useAutoStop();
  const str = useStrengths(boot, billing.data, feed.data?.items);
  const now = Date.now();
  const today = todayKey();
  const stats = useMemo(() => portfolioStats(boot.leads, now), [boot.leads]); // eslint-disable-line react-hooks/exhaustive-deps
  const ag = billing.data ? aging(billing.data.invoices, now) : null;
  const cur = billing.data?.settings.currency || 'SAR';
  const cooling = boot.leads.filter((l) => l.stage === 'عميل نشط' && str[l.id] && str[l.id].score < 55).sort((a, b) => str[a.id].score - str[b.id].score).slice(0, 5);
  const due = agenda(enr, cadences, today);
  const late = ag ? ag.buckets.slice(1).flatMap((b) => b.items).slice(0, 4) : [];
  const meetings = boot.bookings.filter((b) => b.status === 'مؤكد' && Date.parse(b.startIso) > now).sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso)).slice(0, 4);
  const tasks = boot.tasks.filter((x) => x.status === 'مفتوحة' && (isLate(x) || (x.due || '').slice(0, 10) <= today)).slice(0, 5);
  const hour = new Date().getHours();
  const hello = hour < 12 ? t('صباح الخير', 'Good morning') : t('مساء الخير', 'Good evening');
  const first = boot.me.name.startsWith('عبد') ? boot.me.name : boot.me.name.split(' ')[0];
  const leadOf = (id: string) => boot.leads.find((l) => l.id === id);

  return (
    <div>
      <div className="g-desk-greet">
        <div style={{ flex: 1, minWidth: 220 }}>
          <span className="g-eyebrow">{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span>
          <h1>{hello} {first}</h1>
          <p>{cooling.length ? t(`فيه ${cooling.length} عملاء علاقتهم بتبرد، وفيه ${due.length} متابعة مستحقة النهارده.`, `${cooling.length} clients are cooling and ${due.length} follow-ups are due today.`) : t('علاقاتك سليمة النهارده. شوف المتابعات والفلوس.', 'Your relationships look healthy. Check follow-ups and money.')}</p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn btn--primary" onClick={actions.newLead}><Icon name="plus" />{t('عميل جديد', 'New client')}</button>
          <button className="btn" onClick={() => actions.book()}><Icon name="calendar" />{t('احجز اجتماع', 'Book a meeting')}</button>
        </div>
      </div>

      {billing.isLoading ? <Skel h={96} r={16} /> : (
        <Ledger label={t('أرقام اليوم', 'Today’s numbers')} items={[
          { label: t('الاشتراكات الشهرية', 'Monthly recurring'), value: fm(stats.mrr), unit: cur, note: t(`${stats.clients} عميل نشط`, `${stats.clients} active clients`) },
          { label: t('لسه هيتحصل', 'To collect'), value: fm(ag?.total || 0), unit: cur, note: t('فواتير مبعوتة', 'sent invoices') },
          { label: t('متأخر', 'Overdue'), value: fm(ag?.overdue || 0), unit: cur, tone: (ag?.overdue || 0) > 0 ? 'bad' : 'good', note: t('بعد ميعاد الاستحقاق', 'past due') },
          { label: t('علاقات بتبرد', 'Cooling'), value: cooling.length, tone: cooling.length ? 'acc' : 'good', note: t('قوة أقل من 55', 'strength under 55') },
          { label: t('نسبة الخسارة', 'Churn (90d)'), value: Math.round(stats.churnRate * 100), unit: '%', note: t(`${stats.churned} عميل وقف`, `${stats.churned} paused`) }
        ]} />
      )}

      <div className="g-cols">
        <div className="g-grid">
          <Panel id="p-cool" title={t('علاقات محتاجة اهتمام', 'Relationships that need you')} action={<Link to="/clients" className="btn btn--sm btn--ghost">{t('كل العملاء', 'All clients')}</Link>} flush>
            {!feed.data ? <div style={{ padding: 18 }}><Skel h={150} /></div> : cooling.length ? (
              <div className="g-rows">
                {cooling.map((l) => (
                  <Link key={l.id} to={'/clients/' + l.id} className="g-row">
                    <Portrait name={leadName(l)} size={42} score={str[l.id].score} band={str[l.id].band} />
                    <div className="g-row__t"><b>{leadName(l)}</b><small>{str[l.id].lastTouch ? t('آخر تواصل ', 'Last touch ') + ago(new Date(str[l.id].lastTouch!).toISOString(), lang) : t('مفيش تواصل مسجل', 'No contact logged')}</small></div>
                    <div className="g-row__end"><StrengthBadge score={str[l.id].score} band={str[l.id].band} /></div>
                  </Link>
                ))}
              </div>
            ) : <Empty icon="check" title={t('كله تمام', 'All good')}>{t('مفيش عميل علاقته ضعيفة دلوقتي.', 'No client has a weak relationship right now.')}</Empty>}
          </Panel>

          <Panel id="p-money" title={t('فلوس متأخرة', 'Overdue money')} action={<Link to="/billing" className="btn btn--sm btn--ghost">{t('الفوترة', 'Billing')}</Link>} flush>
            {billing.isLoading ? <div style={{ padding: 18 }}><Skel h={110} /></div> : late.length ? (
              <div className="g-rows">
                {late.map((i) => (
                  <Link key={i.id} to={'/clients/' + i.leadId + '?tab=money'} className="g-row">
                    <span className="g-chan"><Icon name="doc" /></span>
                    <div className="g-row__t"><b>{i.leadName}</b><small>{i.id} · {i.label}</small></div>
                    <div className="g-row__end"><div className="num">{money(i.balance ?? i.amount, i.currency)}</div><span className={daysOverdue(i.dueDate, now) > 30 ? 'band-at-risk' : 'band-cooling'}>{t(`متأخر ${i.days} يوم`, `${i.days} days late`)}</span></div>
                  </Link>
                ))}
              </div>
            ) : <Empty icon="check" title={t('مفيش متأخرات', 'Nothing overdue')}>{t('كل الفواتير المبعوتة في ميعادها.', 'Every sent invoice is on time.')}</Empty>}
          </Panel>
        </div>

        <div className="g-grid">
          <Panel id="p-seq" title={t('متابعات النهارده', 'Follow-ups due')} action={<Link to="/sequences" className="btn btn--sm btn--ghost">{t('المتابعات', 'Sequences')}</Link>} flush>
            {due.length ? (
              <div className="g-rows">
                {due.slice(0, 5).map((d) => (
                  <button key={d.enrollment.id + d.index} className="g-row" onClick={() => nav('/sequences')}>
                    <span className="g-chan"><Icon name={d.step.channel === 'wa' ? 'wa' : d.step.channel === 'email' ? 'mail' : d.step.channel === 'call' ? 'phone' : 'tasks'} /></span>
                    <div className="g-row__t"><b>{d.step.title}</b><small>{leadName(leadOf(d.enrollment.leadId))} · {d.cadence.name}</small></div>
                    <span className={'tag ' + (d.state === 'overdue' ? 'tag--bad' : 'tag--acc')}>{d.state === 'overdue' ? t('متأخرة', 'Late') : t('النهارده', 'Today')}</span>
                  </button>
                ))}
              </div>
            ) : <Empty icon="refresh" title={t('مفيش متابعات مستحقة', 'No follow-ups due')}>{t('سجّل عميل في تسلسل متابعة من صفحته.', 'Enrol a client in a sequence from their page.')}</Empty>}
          </Panel>
          <Panel id="p-meet" title={t('اجتماعاتك الجاية', 'Upcoming meetings')} flush>
            {meetings.length ? (
              <div className="g-rows">
                {meetings.map((b) => (
                  <Link key={b.id} to={'/clients/' + b.leadId} className="g-row">
                    <span className="g-chan"><Icon name="video" /></span>
                    <div className="g-row__t"><b>{b.business || b.name}</b><small>{b.meetingType} · {b.platform}</small></div>
                    <div className="g-row__end">{fDT(b.startIso, lang)}</div>
                  </Link>
                ))}
              </div>
            ) : <Empty icon="calendar" title={t('مفيش اجتماعات جاية', 'No meetings ahead')} />}
          </Panel>
          <Panel id="p-tasks" title={t('مهام مستحقة', 'Tasks due')} action={<Link to="/tasks" className="btn btn--sm btn--ghost">{t('المهام', 'Tasks')}</Link>} flush>
            {tasks.length ? (
              <div className="g-rows">{tasks.map((x) => <Link key={x.id} to={x.leadId ? '/clients/' + x.leadId : '/tasks'} className="g-row"><span className="g-chan"><Icon name="tasks" /></span><div className="g-row__t"><b>{x.task}</b><small>{x.leadName}</small></div>{isLate(x) ? <span className="tag tag--bad">{t('متأخرة', 'Late')}</span> : null}</Link>)}</div>
            ) : <Empty icon="check" title={t('مفيش مهام مستحقة', 'No tasks due')} />}
          </Panel>
        </div>
      </div>
    </div>
  );
}
