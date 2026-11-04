/**
 * Relationship strength: one 0–100 number per client, from what really happened between us and them.
 * Pure: everything it needs is passed in, including «now», so it is fully testable.
 *
 *   recency      30  days since the last real touch (call, WhatsApp, email, meeting)
 *   frequency    20  touches in the last 30 days
 *   two-way      15  share of inbound touches in the last 60 days (they talk back)
 *   meetings     15  meetings held in the last 90 days (no-shows cost points)
 *   money        20  invoices paid on time (each overdue invoice costs 8)
 * A paused / lost relationship is capped at 25.
 */
export type StrengthInput = {
  now: number;
  stage: string;
  lastContact?: string;
  activities: { date: string; kind: string; direction: string }[];
  bookings: { startIso: string; status: string }[];
  invoices: { status: string; overdue: boolean }[];
};
export type StrengthFactor = { key: 'recency' | 'frequency' | 'twoWay' | 'meetings' | 'money'; points: number; max: number };
export type Band = 'strong' | 'steady' | 'cooling' | 'at-risk';
export type Strength = { score: number; band: Band; factors: StrengthFactor[]; lastTouch: number | null };

const DAY = 864e5;
export const TOUCH_KINDS = ['مكالمة', 'واتساب', 'إيميل', 'اجتماع'];
const ms = (v: string | undefined) => { const n = v ? Date.parse(v) : NaN; return isNaN(n) ? null : n; };

export function bandOf(score: number): Band {
  return score >= 75 ? 'strong' : score >= 55 ? 'steady' : score >= 35 ? 'cooling' : 'at-risk';
}
export const BAND_LABEL: Record<Band, [string, string]> = {
  strong: ['علاقة قوية', 'Strong'], steady: ['مستقرة', 'Steady'], cooling: ['بتبرد', 'Cooling'], 'at-risk': ['في خطر', 'At risk']
};

export function relationshipStrength(i: StrengthInput): Strength {
  const touches = i.activities.filter((a) => TOUCH_KINDS.includes(a.kind)).map((a) => ({ at: ms(a.date), inbound: a.direction === 'وارد' })).filter((a): a is { at: number; inbound: boolean } => a.at != null && a.at <= i.now);
  const held = i.bookings.filter((b) => b.status === 'تم').map((b) => ms(b.startIso)).filter((x): x is number => x != null && x <= i.now);
  const candidates = [ms(i.lastContact), ...touches.map((t) => t.at), ...held].filter((x): x is number => x != null && x <= i.now);
  const lastTouch = candidates.length ? Math.max(...candidates) : null;

  const days = lastTouch == null ? Infinity : (i.now - lastTouch) / DAY;
  const recency = days <= 3 ? 30 : days <= 7 ? 24 : days <= 14 ? 16 : days <= 30 ? 8 : 0;

  const last30 = touches.filter((t) => i.now - t.at <= 30 * DAY).length;
  const frequency = Math.min(20, last30 * 4);

  const last60 = touches.filter((t) => i.now - t.at <= 60 * DAY);
  const inbound = last60.filter((t) => t.inbound).length;
  const twoWay = last60.length ? Math.min(15, Math.round((inbound / last60.length) * 15 + (inbound > 0 ? 3 : 0))) : 0;

  const held90 = held.filter((t) => i.now - t <= 90 * DAY).length;
  const noShows = i.bookings.filter((b) => b.status === 'لم يحضر' && (ms(b.startIso) ?? 0) > i.now - 90 * DAY).length;
  const meetings = Math.max(0, (held90 >= 2 ? 15 : held90 === 1 ? 8 : 0) - noShows * 5);

  const live = i.invoices.filter((x) => x.status !== 'ملغية');
  const overdue = live.filter((x) => x.overdue).length;
  const money = live.length ? Math.max(0, 20 - overdue * 8) : 10;

  let score = recency + frequency + twoWay + meetings + money;
  if (['متوقف', 'خسرناه'].includes(i.stage)) score = Math.min(score, 25);
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score, band: bandOf(score), lastTouch,
    factors: [
      { key: 'recency', points: recency, max: 30 }, { key: 'frequency', points: frequency, max: 20 }, { key: 'twoWay', points: twoWay, max: 15 },
      { key: 'meetings', points: meetings, max: 15 }, { key: 'money', points: money, max: 20 }
    ]
  };
}
export const FACTOR_LABEL: Record<StrengthFactor['key'], [string, string]> = {
  recency: ['آخر تواصل', 'Recency'], frequency: ['كثافة التواصل', 'Frequency'], twoWay: ['بيرد علينا', 'Two-way'], meetings: ['اجتماعات', 'Meetings'], money: ['الالتزام بالدفع', 'Pays on time']
};
