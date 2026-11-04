import { describe, expect, it } from 'vitest';
import { bandOf, relationshipStrength, type StrengthInput } from '../strength';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const base = (p: Partial<StrengthInput> = {}): StrengthInput => ({ now: NOW, stage: 'عميل نشط', activities: [], bookings: [], invoices: [], ...p });

describe('relationshipStrength', () => {
  it('a client nobody talked to is at risk (money neutral only)', () => {
    const s = relationshipStrength(base());
    expect(s.score).toBe(10);
    expect(s.band).toBe('at-risk');
    expect(s.lastTouch).toBeNull();
  });
  it('recent two-way contact, meetings and clean invoices make a strong relationship', () => {
    const s = relationshipStrength(base({
      activities: [
        { date: ago(1), kind: 'مكالمة', direction: 'صادر' }, { date: ago(2), kind: 'واتساب', direction: 'وارد' },
        { date: ago(6), kind: 'إيميل', direction: 'صادر' }, { date: ago(9), kind: 'واتساب', direction: 'وارد' }, { date: ago(20), kind: 'اجتماع', direction: 'داخلي' }
      ],
      bookings: [{ startIso: ago(10), status: 'تم' }, { startIso: ago(40), status: 'تم' }],
      invoices: [{ status: 'مدفوعة', overdue: false }]
    }));
    expect(s.factors.find((f) => f.key === 'recency')!.points).toBe(30);
    expect(s.factors.find((f) => f.key === 'frequency')!.points).toBe(20);
    expect(s.factors.find((f) => f.key === 'meetings')!.points).toBe(15);
    expect(s.score).toBeGreaterThanOrEqual(75);
    expect(s.band).toBe('strong');
  });
  it('recency decays in steps', () => {
    const r = (d: number) => relationshipStrength(base({ lastContact: ago(d) })).factors[0].points;
    expect([r(2), r(5), r(10), r(20), r(45)]).toEqual([30, 24, 16, 8, 0]);
  });
  it('ignores notes and system lines as touches, and future dates', () => {
    const s = relationshipStrength(base({ activities: [{ date: ago(1), kind: 'ملاحظة', direction: 'داخلي' }, { date: ago(-3), kind: 'مكالمة', direction: 'صادر' }] }));
    expect(s.lastTouch).toBeNull();
  });
  it('each overdue invoice costs 8 points, cancelled ones do not count', () => {
    const m = (inv: StrengthInput['invoices']) => relationshipStrength(base({ invoices: inv })).factors.find((f) => f.key === 'money')!.points;
    expect(m([{ status: 'اتبعت', overdue: true }])).toBe(12);
    expect(m([{ status: 'اتبعت', overdue: true }, { status: 'اتبعت', overdue: true }, { status: 'اتبعت', overdue: true }])).toBe(0);
    expect(m([{ status: 'ملغية', overdue: true }])).toBe(10);
  });
  it('no-shows cost meeting points', () => {
    const s = relationshipStrength(base({ bookings: [{ startIso: ago(5), status: 'تم' }, { startIso: ago(3), status: 'لم يحضر' }] }));
    expect(s.factors.find((f) => f.key === 'meetings')!.points).toBe(3);
  });
  it('a paused client is capped at 25', () => {
    const s = relationshipStrength(base({ stage: 'متوقف', lastContact: ago(1), activities: [1, 2, 3, 4, 5].map((d) => ({ date: ago(d), kind: 'مكالمة', direction: 'وارد' })) }));
    expect(s.score).toBe(25);
  });
  it('bands', () => {
    expect([bandOf(80), bandOf(60), bandOf(40), bandOf(10)]).toEqual(['strong', 'steady', 'cooling', 'at-risk']);
  });
});
