import { describe, expect, it } from 'vitest';
import { monthGrid, mrrTrend, portfolioStats, renewalsByDay, shiftMonth, upsellOpportunities } from '../metrics';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const L = (id: string, p: Partial<Parameters<typeof portfolioStats>[0][number]> = {}) => ({ id, business: 'B' + id, name: 'N', stage: 'عميل نشط', mrr: 5000, dealValue: null, service: 'المحتوى والإعلانات', clientSince: ago(200), renewal: '', updated: ago(1), ...p });

describe('portfolio', () => {
  it('MRR, ARR, churn', () => {
    const s = portfolioStats([L('1', { mrr: 6000 }), L('2', { mrr: 4000, clientSince: ago(10) }), L('3', { stage: 'متوقف', mrr: 3000, updated: ago(20) }), L('4', { stage: 'متوقف', updated: ago(200) }), L('5', { stage: 'جديد', mrr: null })], NOW);
    expect(s).toMatchObject({ clients: 2, mrr: 10000, arr: 120000, avgMrr: 5000, churned: 1, lostMrr: 3000, newThisMonth: 1 });
    expect(s.churnRate).toBeCloseTo(1 / 3);
    expect(portfolioStats([], NOW).churnRate).toBe(0);
  });
  it('month grid starts on Saturday and pads', () => {
    const g = monthGrid('2026-11'); // 1 Nov 2026 is a Sunday
    expect(g[0].slice(0, 2)).toEqual(['', '2026-11-01']);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.flat().filter(Boolean).length).toBe(30);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('renewals by Riyadh day, clients only', () => {
    const m = renewalsByDay([L('1', { renewal: '2026-11-10T22:00:00Z' }), L('2', { renewal: '2026-11-10' }), L('3', { stage: 'متوقف', renewal: '2026-11-10' })]);
    expect(m.get('2026-11-11')!.map((x) => x.id)).toEqual(['1']);
    expect(m.get('2026-11-10')!.map((x) => x.id)).toEqual(['2']);
  });
  it('upsell only for healthy relationships, sorted by potential', () => {
    const leads = [
      L('1', { mrr: 9000 }), L('2', { mrr: 2000, service: 'الاستشارات', renewal: new Date(NOW + 20 * 864e5).toISOString() }), L('3', { mrr: 2000 })
    ];
    const ups = upsellOpportunities(leads, [{ leadId: '1', status: 'اتبعت', overdue: true }], { '1': 80, '2': 70, '3': 30 }, NOW);
    expect(ups.some((u) => u.leadId === '3')).toBe(false);
    expect(ups.filter((u) => u.leadId === '2').map((u) => u.kind).sort()).toEqual(['annual', 'cross-sell', 'renewal', 'upgrade']);
    expect(ups.some((u) => u.leadId === '1' && u.kind === 'annual')).toBe(false); // overdue invoice
    expect(ups.map((u) => u.potential)).toEqual([...ups.map((u) => u.potential)].sort((a, b) => b - a));
  });
  it('MRR trend rebuilds months from start dates', () => {
    const t = mrrTrend([L('1', { mrr: 1000, clientSince: ago(100) }), L('2', { mrr: 500, clientSince: ago(5) }), L('3', { stage: 'متوقف', mrr: 300, clientSince: ago(100), updated: ago(10) })], NOW, 3);
    expect(t.map((x) => x.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(t.map((x) => x.mrr)).toEqual([1300, 1500, 1500]);
  });
});
