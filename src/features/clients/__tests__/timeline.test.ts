import { describe, expect, it } from 'vitest';
import { activityKind, buildTimeline, filterTimeline, groupByDay } from '../timeline';

const act = (id: string, date: string, kind: string, direction = 'صادر') => ({ id, date, kind, direction, summary: kind + ' ' + id, details: '', by: 'نور حسن' });
describe('timeline', () => {
  it('maps activity kinds', () => {
    expect(['مكالمة', 'واتساب', 'إيميل', 'تغيير مرحلة', 'شيء'].map(activityKind)).toEqual(['call', 'whatsapp', 'email', 'stage', 'system']);
  });
  it('merges every source newest first', () => {
    const tl = buildTimeline({
      activities: [act('1', '2026-10-01T10:00:00Z', 'مكالمة'), act('2', '2026-10-05T10:00:00Z', 'واتساب', 'وارد')],
      bookings: [{ id: 'M1', startIso: '2026-10-03T10:00:00Z', meetingType: 'استشارة', status: 'تم', outcome: 'اتفقنا', platform: 'Meet' }],
      quotes: [{ id: 'Q1', date: '2026-10-04T00:00:00Z', status: 'اتبعت', total: 9000, currency: 'SAR', sentAt: '2026-10-04T09:00:00Z', decidedAt: '' }],
      invoices: [{ id: 'I1', date: '2026-10-06T00:00:00Z', label: 'أولى', status: 'اتبعت', amount: 4500, currency: 'SAR', sentAt: '' }, { id: 'I2', date: '2026-10-06T00:00:00Z', label: 'تانية', status: 'مجدولة', amount: 4500, currency: 'SAR', sentAt: '' }],
      payments: [{ id: 'P1', date: '2026-10-07T00:00:00Z', created: '', invoiceId: 'I1', amount: 4500, currency: 'SAR', ref: 'TRX', by: 'x' }],
      notes: [{ id: 'n1', at: '2026-10-02T00:00:00Z', by: 'عبد الله', text: 'ملاحظة' }]
    });
    expect(tl.map((x) => x.kind)).toEqual(['payment', 'invoice', 'whatsapp', 'quote', 'meeting', 'note', 'call']);
    expect(tl.find((x) => x.kind === 'whatsapp')!.inbound).toBe(true);
    expect(tl.some((x) => x.id === 'i:I2')).toBe(false); // scheduled invoices aren't events yet
  });
  it('drops finance log lines when billing rows are present (no duplicates)', () => {
    const a = [act('1', '2026-10-01T10:00:00Z', 'مالية')];
    expect(buildTimeline({ activities: a, quotes: [] }).length).toBe(0);
    expect(buildTimeline({ activities: a })[0].kind).toBe('invoice');
  });
  it('filters by group and groups by Riyadh day', () => {
    const tl = buildTimeline({ activities: [act('1', '2026-10-01T22:30:00Z', 'مكالمة'), act('2', '2026-10-01T10:00:00Z', 'تغيير مرحلة')] });
    expect(filterTimeline(tl, 'talk').length).toBe(1);
    expect(filterTimeline(tl, 'all').length).toBe(2);
    expect(groupByDay(tl).map((g) => g.day)).toEqual(['2026-10-02', '2026-10-01']);
  });
});
