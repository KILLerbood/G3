import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBoot } from '../../app/boot';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Empty, Skel } from '../../components/ui';
import { AreaChart, Ledger, Panel, Portrait, StrengthBadge } from '../../components/g3';
import { leadName } from '../../lib/rules';
import { fDate, fMonth, money as fm } from '../../lib/format';
import { todayKey } from '../../lib/time';
import { useAllBilling, useChecklists, useProjects, useRecentActivity, useStrengths } from '../clients/data';
import { progress } from '../clients/onboarding';
import { ProjectsPanel } from '../clients/Delivery';
import { BAND_LABEL, type Band } from '../clients/strength';
import { isClient, monthGrid, mrrTrend, portfolioStats, renewalsByDay, shiftMonth, upsellOpportunities } from './metrics';

type Tab = 'clients' | 'renewals' | 'upsell' | 'delivery';
const KIND_LABEL = { 'cross-sell': ['بيع خدمة تانية', 'Cross-sell'], upgrade: ['ترقية', 'Upgrade'], annual: ['اشتراك سنوي', 'Annual'], renewal: ['تجديد أكبر', 'Bigger renewal'] } as const;

export function Portfolio() {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const nav = useNavigate();
  const billing = useAllBilling();
  const feed = useRecentActivity();
  const str = useStrengths(boot, billing.data, feed.data?.items);
  const [tab, setTab] = useState<Tab>('clients');
  const [band, setBand] = useState<'all' | Band>('all');
  const [q, setQ] = useState('');
  const [ym, setYm] = useState(() => todayKey().slice(0, 7));
  const [checks] = useChecklists();
  const [projects] = useProjects();
  const now = Date.now();
  const cur = billing.data?.settings.currency || 'SAR';
  const stats = useMemo(() => portfolioStats(boot.leads, now), [boot.leads]); // eslint-disable-line react-hooks/exhaustive-deps
  const trend = useMemo(() => mrrTrend(boot.leads, now, 6), [boot.leads]); // eslint-disable-line react-hooks/exhaustive-deps
  const clients = boot.leads.filter(isClient);
  const strengthMap = useMemo(() => Object.fromEntries(Object.entries(str).map(([k, v]) => [k, v.score])), [str]);
  const ups = useMemo(() => upsellOpportunities(boot.leads, billing.data?.invoices || [], strengthMap, now), [boot.leads, billing.data, strengthMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const renewals = useMemo(() => renewalsByDay(boot.leads), [boot.leads]);
  const shown = clients.filter((l) => (band === 'all' || str[l.id]?.band === band) && (!q || (leadName(l) + l.name).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (str[a.id]?.score ?? 0) - (str[b.id]?.score ?? 0));
  const upsellTotal = ups.reduce((a, u) => a + u.potential, 0);
  const next30 = [...renewals.entries()].filter(([d]) => d >= todayKey()).sort().slice(0, 40).flatMap(([d, ls]) => ls.map((l) => ({ d, l }))).filter((x) => Date.parse(x.d) - now < 45 * 864e5);
  const cells = monthGrid(ym);
  const dows = lang === 'ar' ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'] : ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];

  return (
    <div>
      <div className="g-hero">
        <div style={{ flex: 1, minWidth: 240 }}><span className="g-eyebrow">{t('المحفظة', 'Portfolio')}</span><h1>{t('محفظة العملاء', 'Client portfolio')}</h1><p>{t('الاشتراكات، الخسارة، التجديدات وفرص النمو في مكان واحد.', 'MRR, churn, renewals and growth chances in one place.')}</p></div>
      </div>
      <Ledger label={t('أرقام المحفظة', 'Portfolio numbers')} items={[
        { label: t('الاشتراكات الشهرية (MRR)', 'MRR'), value: fm(stats.mrr), unit: cur, note: t(`سنويًا ${fm(stats.arr)}`, `ARR ${fm(stats.arr)}`) },
        { label: t('عملاء نشطين', 'Active clients'), value: stats.clients, note: t(`+${stats.newThisMonth} آخر 30 يوم`, `+${stats.newThisMonth} in 30 days`), tone: 'good' },
        { label: t('متوسط الاشتراك', 'Avg MRR'), value: fm(stats.avgMrr), unit: cur },
        { label: t('نسبة الخسارة (90 يوم)', 'Churn (90d)'), value: Math.round(stats.churnRate * 100), unit: '%', tone: stats.churned ? 'bad' : 'good', note: t(`${stats.churned} عميل · ${fm(stats.lostMrr)} ${cur}`, `${stats.churned} clients · ${fm(stats.lostMrr)} ${cur}`) },
        { label: t('فرص البيع الإضافي', 'Upsell potential'), value: fm(upsellTotal), unit: cur + '/' + t('شهر', 'mo'), tone: 'acc', note: t(`${ups.length} فرصة`, `${ups.length} chances`) }
      ]} />

      <div className="g-cols" style={{ marginBottom: 18 }}>
        <Panel title={t('نمو الاشتراكات الشهرية', 'MRR over the last 6 months')}>
          {billing.isLoading ? <Skel h={170} /> : <AreaChart label={t('MRR', 'MRR')} points={trend.map((p) => ({ x: fMonth(p.month + '-15T12:00:00Z', lang), y: p.mrr }))} />}
        </Panel>
        <Panel title={t('صحة العلاقات', 'Relationship health')}>
          <div className="stack" style={{ gap: 10 }}>
            {(['strong', 'steady', 'cooling', 'at-risk'] as Band[]).map((b) => {
              const n = clients.filter((l) => str[l.id]?.band === b).length;
              return <button key={b} className="row" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => { setBand(b); setTab('clients'); }} aria-label={t(BAND_LABEL[b][0], BAND_LABEL[b][1]) + ': ' + n}>
                <span className={'band-' + b} style={{ width: 90, fontWeight: 700, fontSize: 13 }}>{t(BAND_LABEL[b][0], BAND_LABEL[b][1])}</span>
                <div className="g-bar grow" style={{ height: 10 }}><i style={{ width: (clients.length ? (n / clients.length) * 100 : 0) + '%', background: `var(--${b === 'strong' ? 'good' : b === 'steady' ? 'g-forest-2' : b === 'cooling' ? 'warn' : 'bad'})` }} /></div>
                <b className="num">{n}</b>
              </button>;
            })}
          </div>
        </Panel>
      </div>

      <div className="g-tabs" role="tablist" aria-label={t('أقسام المحفظة', 'Portfolio sections')}>
        {([['clients', t('العملاء', 'Clients'), clients.length], ['renewals', t('تقويم التجديدات', 'Renewals calendar'), next30.length], ['upsell', t('فرص البيع', 'Upsell'), ups.length], ['delivery', t('التأهيل والمشاريع', 'Onboarding & projects'), projects.length]] as [Tab, string, number][]).map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n ? <span className="n">{n}</span> : null}</button>
        ))}
      </div>

      {tab === 'clients' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <label className="search" style={{ flex: '1 1 220px', maxWidth: 340 }}><Icon name="search" /><span className="sr-only">{t('دوّر في العملاء', 'Search clients')}</span><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('دوّر في العملاء…', 'Search clients…')} /></label>
            <div className="chips" role="group" aria-label={t('فلتر قوة العلاقة', 'Strength filter')}>
              {(['all', 'strong', 'steady', 'cooling', 'at-risk'] as const).map((b) => <button key={b} className="chip" aria-pressed={band === b} onClick={() => setBand(b)}>{b === 'all' ? t('الكل', 'All') : t(BAND_LABEL[b][0], BAND_LABEL[b][1])}</button>)}
            </div>
          </div>
          {boot.leads.length && !clients.length ? <Empty icon="users" title={t('مفيش عملاء نشطين لسه', 'No active clients yet')} /> : null}
          <div className="g-clients">
            {shown.map((l) => {
              const s = str[l.id]; const cl = checks[l.id]; const pr = cl ? progress(cl) : null;
              return (
                <Link key={l.id} to={'/clients/' + l.id} className="g-ccard">
                  <div className="g-ccard__top">
                    <Portrait name={leadName(l)} size={52} score={s?.score} band={s?.band} />
                    <div style={{ minWidth: 0 }}><b className="ellipsis">{leadName(l)}</b><small className="ellipsis">{l.name} · {l.city}</small></div>
                  </div>
                  <div className="row"><span className="g-ccard__mrr">{fm(l.mrr)} <small className="faint" style={{ fontFamily: 'var(--f-body)', fontSize: 12 }}>{cur}/{t('شهر', 'mo')}</small></span><span className="grow" />{s ? <StrengthBadge score={s.score} band={s.band} /> : null}</div>
                  <div className="g-ccard__row">
                    {l.renewal ? <span className="tag"><Icon name="calendar" size={12} />{t('تجديد ', 'Renews ')}{fDate(l.renewal, lang)}</span> : null}
                    {ups.some((u) => u.leadId === l.id) ? <span className="tag tag--hl">{t('فرصة بيع', 'Upsell')}</span> : null}
                  </div>
                  {pr ? <div><div className="g-hint" style={{ marginBottom: 4 }}>{t('التأهيل ', 'Onboarding ')}{pr.pct}%</div><div className="g-bar"><i style={{ width: pr.pct + '%' }} /></div></div> : null}
                </Link>
              );
            })}
          </div>
          {clients.length && !shown.length ? <Empty icon="search" title={t('مفيش نتيجة', 'No match')} /> : null}
        </div>
      )}

      {tab === 'renewals' && (
        <div className="g-cols">
          <Panel title={fMonth(ym + '-15T12:00:00Z', lang) + ' ' + ym.slice(0, 4)} action={<div className="row" style={{ gap: 4 }}><button className="ibtn ibtn--sm flip" aria-label={t('الشهر اللي فات', 'Previous month')} onClick={() => setYm(shiftMonth(ym, -1))}><Icon name="next" /></button><button className="ibtn ibtn--sm flip" aria-label={t('الشهر الجاي', 'Next month')} onClick={() => setYm(shiftMonth(ym, 1))}><Icon name="back" /></button></div>}>
            <table className="g-cal" aria-label={t('تقويم التجديدات', 'Renewals calendar')}>
              <thead><tr>{dows.map((d) => <th key={d} scope="col">{d}</th>)}</tr></thead>
              <tbody>
                {cells.map((w, i) => (
                  <tr key={i}>{w.map((d, j) => (
                    <td key={j} className={(d ? '' : 'is-empty ') + (d === todayKey() ? 'is-today' : '')}>
                      {d ? <span>{Number(d.slice(8))}</span> : null}
                      {(renewals.get(d) || []).map((l) => <button key={l.id} className="g-dot" onClick={() => nav('/clients/' + l.id)} title={leadName(l) + ' · ' + fm(l.mrr)}>{leadName(l)}</button>)}
                    </td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title={t('الـ 45 يوم الجايين', 'Next 45 days')} flush>
            {next30.length ? <div className="g-rows">{next30.map(({ d, l }) => (
              <Link key={l.id} to={'/clients/' + l.id} className="g-row"><Portrait name={leadName(l)} size={36} score={str[l.id]?.score} band={str[l.id]?.band} /><div className="g-row__t"><b>{leadName(l)}</b><small>{fDate(d, lang)}</small></div><div className="g-row__end"><span className="num">{fm(l.mrr)}</span> {cur}</div></Link>
            ))}</div> : <Empty icon="calendar" title={t('مفيش تجديدات قريبة', 'No renewals soon')} />}
          </Panel>
        </div>
      )}

      {tab === 'upsell' && (
        <Panel title={t('فرص بيع إضافي', 'Upsell opportunities')} flush>
          <p className="g-hint" style={{ margin: 0, padding: '10px 18px' }}>{t('بنقترح بس للعملاء اللي علاقتهم قوية (55 فأكتر) وماعندهمش فواتير متأخرة.', 'Only clients with a healthy relationship (55+) are suggested.')}</p>
          {ups.length ? ups.map((u, i) => {
            const l = boot.leads.find((x) => x.id === u.leadId)!;
            return (
              <div key={i} className="g-ups">
                <Portrait name={leadName(l)} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}><span className="g-ups__k">{t(KIND_LABEL[u.kind][0], KIND_LABEL[u.kind][1])}</span> <Link to={'/clients/' + l.id}><b style={{ display: 'inline' }}>{leadName(l)}</b></Link><br /><small>{t(u.reason[0], u.reason[1])}</small><br /><small><b style={{ display: 'inline', color: 'var(--ink-2)' }}>{t(u.offer[0], u.offer[1])}</b></small></div>
                <span className="g-ups__pot">+{fm(u.potential)}<br /><small className="faint" style={{ fontFamily: 'var(--f-body)' }}>{cur}</small></span>
              </div>
            );
          }) : <Empty icon="sparkle" title={t('مفيش فرص دلوقتي', 'No chances right now')} />}
        </Panel>
      )}

      {tab === 'delivery' && <Panel title={t('كل المشاريع الجارية', 'All projects in flight')}><ProjectsPanel /></Panel>}
    </div>
  );
}
