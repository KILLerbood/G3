import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBoot } from '../../app/boot';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Empty, Skel } from '../../components/ui';
import { Ledger, Panel, Portrait } from '../../components/g3';
import { fDate } from '../../lib/format';
import { download, toCsv } from '../../lib/rules';
import { useAllBilling, useContracts } from '../clients/data';
import { aging, BUCKET_LABEL, type BucketKey } from './flow';
import { ReminderModal } from './ReminderModal';
import { money } from './render';
import type { Invoice } from '../../api/schemas';

type Tab = 'board' | 'aging';
const short = (n: number, cur: string) => money(n, cur).replace('.00', '');

/** Billing & collections: the whole money path across clients, receivables by age, and reminders. */
export function BillingHub() {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const q = useAllBilling();
  const [contracts] = useContracts();
  const [tab, setTab] = useState<Tab>('board');
  const [bucket, setBucket] = useState<BucketKey | 'all'>('all');
  const [remind, setRemind] = useState<Invoice | null>(null);
  const now = Date.now();
  const b = q.data;
  const cur = b?.settings.currency || 'SAR';
  const ag = useMemo(() => (b ? aging(b.invoices, now) : null), [b]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.isLoading || !b || !ag) return <div className="stack" style={{ gap: 16 }}><Skel h={60} w="40%" /><Skel h={96} r={16} /><Skel h={340} r={16} /></div>;
  const collected = b.payments.reduce((a, p) => a + p.amount, 0);
  const contracted = b.quotes.filter((x) => x.status === 'اتوافق عليه').reduce((a, x) => a + x.total, 0);
  const openQuotes = b.quotes.filter((x) => ['مسودة', 'اتبعت', 'اتفتح'].includes(x.status));
  const accepted = b.quotes.filter((x) => x.status === 'اتوافق عليه');
  const needSign = accepted.filter((x) => contracts.find((c) => c.quoteId === x.id)?.status !== 'signed');
  const invoicesOpen = b.invoices.filter((i) => ['مسودة', 'اتبعت', 'مدفوعة جزئيًا'].includes(i.status));
  const paid = b.invoices.filter((i) => i.status === 'مدفوعة');
  const lead = (id: string) => boot.leads.find((l) => l.id === id);
  const rows = ag.buckets.filter((x) => bucket === 'all' || x.key === bucket).flatMap((x) => x.items);
  const max = Math.max(1, ...ag.buckets.map((x) => x.total));
  const exportCsv = () => download('receivables.csv', toCsv([['الفاتورة', 'العميل', 'المتبقي', 'الاستحقاق', 'أيام التأخير'], ...rows.map((i) => [i.id, i.leadName, i.balance ?? i.amount, i.dueDate.slice(0, 10), i.days])]));

  const Deal = ({ id, name, amt, sub, tag, tone }: { id: string; name: string; amt: number; sub: string; tag?: string; tone?: string }) => (
    <Link to={'/clients/' + id + '?tab=money'} className="g-deal"><b>{name}</b><span className="g-amt">{short(amt, cur)}</span><span className="row">{sub}{tag ? <span className={'tag ' + (tone || '')}>{tag}</span> : null}</span></Link>
  );
  const Col = ({ title, total, children, empty }: { title: string; total: number; children: React.ReactNode[]; empty: string }) => (
    <div className="g-board__col"><header><b>{title}</b><span>{short(total, cur)}</span></header>{children.length ? children : <p className="g-hint" style={{ margin: 8 }}>{empty}</p>}</div>
  );

  return (
    <div>
      <div className="g-hero"><div style={{ flex: 1, minWidth: 240 }}><span className="g-eyebrow">{t('الفلوس', 'Money')}</span><h1>{t('الفوترة والتحصيل', 'Billing & collections')}</h1><p>{t('عرض ← عقد ← فاتورة ← دفعة، وتحصيل المتأخرات بتذكيرات عربي جاهزة.', 'Quote → contract → invoice → payment, and collect late money with ready Arabic reminders.')}</p></div></div>
      <Ledger label={t('أرقام الفوترة', 'Billing numbers')} items={[
        { label: t('عروض مفتوحة', 'Open quotes'), value: short(openQuotes.reduce((a, x) => a + x.total, 0), cur), note: t(`${openQuotes.length} عرض`, `${openQuotes.length} quotes`) },
        { label: t('قيمة العقود', 'Contracted'), value: short(contracted, cur), note: t(`${needSign.length} مستني توقيع`, `${needSign.length} to sign`) },
        { label: t('لسه هيتحصل', 'To collect'), value: short(ag.total, cur) },
        { label: t('متأخر', 'Overdue'), value: short(ag.overdue, cur), tone: ag.overdue ? 'bad' : 'good' },
        { label: t('المتحصّل', 'Collected'), value: short(collected, cur), tone: 'good' }
      ]} />
      <div className="g-tabs" role="tablist" aria-label={t('عرض الفوترة', 'Billing view')}>
        <button role="tab" aria-selected={tab === 'board'} onClick={() => setTab('board')}>{t('مسار الصفقات', 'Deal flow')}</button>
        <button role="tab" aria-selected={tab === 'aging'} onClick={() => setTab('aging')}>{t('أعمار الديون', 'Receivables aging')}{ag.overdue ? <span className="n">{rowsCount(ag)}</span> : null}</button>
      </div>

      {tab === 'board' && (
        <div className="g-board">
          <Col title={t('1 · عروض السعر', '1 · Quotes')} total={openQuotes.reduce((a, x) => a + x.total, 0)} empty={t('مفيش عروض مفتوحة', 'No open quotes')}>
            {openQuotes.map((x) => <Deal key={x.id} id={x.leadId} name={x.leadName} amt={x.total} sub={x.id} tag={x.status} tone={x.status === 'اتفتح' ? 'tag--acc' : x.status === 'اتبعت' ? 'tag--info' : ''} />)}
          </Col>
          <Col title={t('2 · العقود', '2 · Contracts')} total={needSign.reduce((a, x) => a + x.total, 0)} empty={t('مفيش عقود مستنية', 'No contracts waiting')}>
            {needSign.map((x) => { const c = contracts.find((k) => k.quoteId === x.id); return <Deal key={x.id} id={x.leadId} name={x.leadName} amt={x.total} sub={x.id} tag={c ? (c.status === 'sent' ? t('مستني التوقيع', 'To sign') : t('مسودة', 'Draft')) : t('جهّز العقد', 'Prepare')} tone="tag--warn" />; })}
          </Col>
          <Col title={t('3 · الفواتير', '3 · Invoices')} total={invoicesOpen.reduce((a, x) => a + (x.balance ?? x.amount), 0)} empty={t('مفيش فواتير مفتوحة', 'No open invoices')}>
            {invoicesOpen.map((x) => <Deal key={x.id} id={x.leadId} name={x.leadName} amt={x.balance ?? x.amount} sub={x.id + ' · ' + x.label} tag={x.overdue ? t('متأخرة', 'Late') : x.status} tone={x.overdue ? 'tag--bad' : ''} />)}
          </Col>
          <Col title={t('4 · مدفوعة', '4 · Paid')} total={paid.reduce((a, x) => a + x.amount, 0)} empty={t('لسه مفيش', 'None yet')}>
            {paid.slice(0, 12).map((x) => <Deal key={x.id} id={x.leadId} name={x.leadName} amt={x.amount} sub={x.id} tag={t('مدفوعة', 'Paid')} tone="tag--good" />)}
          </Col>
        </div>
      )}

      {tab === 'aging' && (
        <div className="g-grid">
          <div className="g-aging" role="group" aria-label={t('أعمار الديون', 'Aging buckets')}>
            {ag.buckets.map((x, i) => (
              <button key={x.key} className={'b' + i} aria-pressed={bucket === x.key} onClick={() => setBucket(bucket === x.key ? 'all' : x.key)}>
                <small>{t(BUCKET_LABEL[x.key][0], BUCKET_LABEL[x.key][1])}</small>
                <b className="num">{short(x.total, cur)}</b>
                <div className="g-bar" aria-hidden="true"><i style={{ height: Math.max(x.total ? 8 : 0, (x.total / max) * 100) + '%' }} /></div>
                <small>{x.count} {t('فاتورة', 'invoices')}</small>
              </button>
            ))}
          </div>
          <Panel title={t('الفواتير المستحقة', 'Outstanding invoices')} action={<button className="btn btn--sm" onClick={exportCsv} disabled={!rows.length}><Icon name="download" />CSV</button>} flush>
            {rows.length ? (
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th scope="col">{t('العميل', 'Client')}</th><th scope="col">{t('الفاتورة', 'Invoice')}</th><th scope="col" className="n">{t('المتبقي', 'Balance')}</th><th scope="col">{t('الاستحقاق', 'Due')}</th><th scope="col">{t('التأخير', 'Late')}</th><th scope="col"><span className="sr-only">{t('إجراء', 'Action')}</span></th></tr></thead>
                <tbody>{rows.map((i) => (
                  <tr key={i.id}>
                    <td><Link to={'/clients/' + i.leadId + '?tab=money'} className="row" style={{ gap: 8, color: 'inherit' }}><Portrait name={i.leadName} size={30} /><b>{i.leadName}</b></Link></td>
                    <td className="num">{i.id}<br /><small className="faint">{i.label}</small></td>
                    <td className="n num">{short(i.balance ?? i.amount, i.currency)}</td>
                    <td>{fDate(i.dueDate, lang)}</td>
                    <td>{i.days > 0 ? <span className={i.days > 30 ? 'band-at-risk' : 'band-cooling'}><b className="num">{i.days}</b> {t('يوم', 'd')}</span> : <span className="faint">—</span>}</td>
                    <td><button className="btn btn--sm btn--primary" disabled={!lead(i.leadId)} onClick={() => setRemind(i as unknown as Invoice)}><Icon name="wa" />{t('ذكّره', 'Remind')}</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <Empty icon="check" title={t('مفيش ديون هنا', 'Nothing outstanding here')} />}
          </Panel>
        </div>
      )}
      {remind && lead(remind.leadId) ? <ReminderModal inv={b.invoices.find((x) => x.id === remind.id) || remind} lead={lead(remind.leadId)!} onClose={() => setRemind(null)} /> : null}
    </div>
  );
}
const rowsCount = (ag: ReturnType<typeof aging>) => ag.buckets.slice(1).reduce((a, x) => a + x.count, 0);
