/** Portfolio numbers for clients: MRR, churn, renewals calendar, upsell opportunities. Pure. */
type L = { id: string; business: string; name: string; stage: string; mrr: number | null; dealValue: number | null; service: string; clientSince: string; renewal: string; updated: string };
type Inv = { leadId: string; status: string; overdue: boolean };

const DAY = 864e5;
const ms = (v: string) => { const n = Date.parse(v); return isNaN(n) ? null : n; };
export const isClient = (l: Pick<L, 'stage'>) => l.stage === 'عميل نشط';

export function portfolioStats(leads: L[], now: number) {
  const clients = leads.filter(isClient);
  const mrr = clients.reduce((a, l) => a + (l.mrr || 0), 0);
  // Churned = moved to «متوقف» in the last 90 days (the sheet keeps their last MRR in dealValue / mrr).
  const churned = leads.filter((l) => l.stage === 'متوقف' && (ms(l.updated) ?? 0) > now - 90 * DAY);
  const base = clients.length + churned.length;
  const newThisMonth = clients.filter((l) => { const t = ms(l.clientSince); return t != null && now - t <= 30 * DAY; }).length;
  return {
    clients: clients.length, mrr, arr: mrr * 12, avgMrr: clients.length ? Math.round(mrr / clients.length) : 0,
    churned: churned.length, churnRate: base ? churned.length / base : 0, lostMrr: churned.reduce((a, l) => a + (l.mrr || 0), 0), newThisMonth
  };
}

/** Month grid (weeks × 7, Saturday first as in KSA calendars) for yyyy-mm, days outside the month as ''. */
export function monthGrid(ym: string): string[][] {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 1) % 7; // Sat=0 … Fri=6
  const cells: string[] = Array(lead).fill('');
  for (let d = 1; d <= days; d++) cells.push(ym + '-' + String(d).padStart(2, '0'));
  while (cells.length % 7) cells.push('');
  const out: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}
export const shiftMonth = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

/** Clients by renewal day (yyyy-mm-dd). */
export function renewalsByDay(leads: L[]): Map<string, L[]> {
  const out = new Map<string, L[]>();
  leads.filter((l) => isClient(l) && l.renewal).forEach((l) => {
    const d = new Date(Date.parse(l.renewal) + 3 * 3600e3).toISOString().slice(0, 10);
    out.set(d, [...(out.get(d) || []), l]);
  });
  return out;
}

export type Upsell = { leadId: string; kind: 'cross-sell' | 'upgrade' | 'annual' | 'renewal'; potential: number; reason: [string, string]; offer: [string, string] };
const NEXT_SERVICE: Record<string, [string, string]> = {
  'دراسة السوق': ['المحتوى والإعلانات', 'Content & ads'],
  'المحتوى والإعلانات': ['المواقع والمعارض 3D', '3D showrooms'],
  'المواقع والمعارض 3D': ['المحتوى والإعلانات', 'Content & ads'],
  'الاستشارات': ['باقة متكاملة', 'Full package']
};

/**
 * Upsell opportunities. Only for healthy relationships (strength ≥ 55): asking an unhappy client for more money backfires.
 *  - cross-sell: one service only → the natural next one
 *  - upgrade: MRR well under the portfolio average
 *  - annual: 90+ days a client, nothing overdue → offer a yearly prepay
 *  - renewal: renewal in the next 45 days → renew with a bigger scope
 */
export function upsellOpportunities(leads: L[], invoices: Inv[], strength: Record<string, number>, now: number): Upsell[] {
  const clients = leads.filter(isClient);
  const avg = clients.length ? clients.reduce((a, l) => a + (l.mrr || 0), 0) / clients.length : 0;
  const out: Upsell[] = [];
  clients.forEach((l) => {
    if ((strength[l.id] ?? 0) < 55) return;
    const mrr = l.mrr || 0;
    const next = NEXT_SERVICE[l.service];
    if (next) out.push({ leadId: l.id, kind: 'cross-sell', potential: Math.round(Math.max(avg, mrr) * 0.5), reason: ['شغال على خدمة واحدة: ' + l.service, 'Uses one service: ' + l.service], offer: ['اعرض «' + next[0] + '»', 'Offer «' + next[1] + '»'] });
    if (avg && mrr < avg * 0.7) out.push({ leadId: l.id, kind: 'upgrade', potential: Math.round(avg - mrr), reason: ['اشتراكه أقل من متوسط العملاء', 'MRR below the client average'], offer: ['رقّيه للباقة الأعلى', 'Upgrade the plan'] });
    const since = ms(l.clientSince);
    const late = invoices.some((i) => i.leadId === l.id && i.overdue && i.status !== 'ملغية');
    if (since != null && now - since >= 90 * DAY && !late && mrr) out.push({ leadId: l.id, kind: 'annual', potential: mrr * 2, reason: ['عميل من أكتر من 3 شهور وبيدفع في ميعاده', 'Client 3+ months, pays on time'], offer: ['اعرض اشتراك سنوي بخصم شهرين', 'Offer a yearly plan, 2 months off'] });
    const ren = ms(l.renewal);
    if (ren != null && ren >= now - DAY && ren - now <= 45 * DAY) out.push({ leadId: l.id, kind: 'renewal', potential: Math.round(mrr * 0.3), reason: ['التجديد خلال 45 يوم', 'Renews within 45 days'], offer: ['جدّد بنطاق أكبر (+30%)', 'Renew with a bigger scope (+30%)'] });
  });
  return out.sort((a, b) => b.potential - a.potential);
}

/** MRR by month for the last n months, rebuilt from client start dates (the sheet keeps only today's MRR). */
export function mrrTrend(leads: L[], now: number, n = 6): { month: string; mrr: number }[] {
  const out: { month: string; mrr: number }[] = [];
  const cur = new Date(now + 3 * 3600e3).toISOString().slice(0, 7);
  for (let i = n - 1; i >= 0; i--) {
    const month = shiftMonth(cur, -i);
    const end = Date.parse(shiftMonth(month, 1) + '-01T00:00:00+03:00');
    const mrr = leads.filter((l) => (l.mrr || 0) > 0 && (isClient(l) || l.stage === 'متوقف')).filter((l) => {
      const s = ms(l.clientSince);
      if (s == null || s >= end) return false;
      if (l.stage === 'متوقف') { const u = ms(l.updated); return u == null || u >= end; }
      return true;
    }).reduce((a, l) => a + (l.mrr || 0), 0);
    out.push({ month, mrr });
  }
  return out;
}
