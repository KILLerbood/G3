/**
 * One timeline per client: everything that happened, from every source, newest first.
 * Calls, WhatsApp, emails and stage changes come from the activity log; meetings from bookings;
 * quotes, invoices and payments from billing; notes from this device. Pure.
 */
export type TLKind = 'call' | 'whatsapp' | 'email' | 'meeting' | 'note' | 'stage' | 'quote' | 'invoice' | 'payment' | 'system';
export type TLItem = { id: string; at: string; kind: TLKind; title: string; body?: string; by?: string; inbound?: boolean; amount?: number; currency?: string; ref?: string };

type Act = { id: string; date: string; kind: string; direction: string; summary: string; details: string; by: string };
type Bk = { id: string; startIso: string; meetingType: string; status: string; outcome: string; platform: string };
type Qt = { id: string; date: string; status: string; total: number; currency: string; sentAt: string; decidedAt: string };
type Inv = { id: string; date: string; label: string; status: string; amount: number; currency: string; sentAt: string };
type Pay = { id: string; date: string; created: string; invoiceId: string; amount: number; currency: string; ref: string; by: string };
type Note = { id: string; at: string; by: string; text: string };

const KIND: Record<string, TLKind> = { 'مكالمة': 'call', 'واتساب': 'whatsapp', 'إيميل': 'email', 'اجتماع': 'meeting', 'ملاحظة': 'note', 'تغيير مرحلة': 'stage', 'نظام': 'system' };
export const activityKind = (k: string): TLKind => KIND[k] || 'system';

export function buildTimeline(src: { activities?: Act[]; bookings?: Bk[]; quotes?: Qt[]; invoices?: Inv[]; payments?: Pay[]; notes?: Note[] }): TLItem[] {
  const out: TLItem[] = [];
  const hasBilling = !!(src.quotes || src.invoices || src.payments);
  (src.activities || []).forEach((a) => {
    // Billing writes its own «مالية» lines; when billing rows are here they tell the same story with amounts.
    if (a.kind === 'مالية' && hasBilling) return;
    const kind = a.kind === 'مالية' ? 'invoice' : activityKind(a.kind);
    out.push({ id: 'a:' + a.id, at: a.date, kind, title: a.summary, body: a.details || undefined, by: a.by, inbound: a.direction === 'وارد' });
  });
  (src.bookings || []).forEach((b) => out.push({ id: 'b:' + b.id, at: b.startIso, kind: 'meeting', title: b.meetingType + ' · ' + b.status, body: b.outcome || undefined, ref: b.platform }));
  (src.quotes || []).forEach((q) => {
    out.push({ id: 'q:' + q.id, at: q.sentAt || q.date, kind: 'quote', title: q.id + ' · ' + q.status, amount: q.total, currency: q.currency, ref: q.id });
  });
  (src.invoices || []).forEach((i) => { if (i.status !== 'مجدولة') out.push({ id: 'i:' + i.id, at: i.sentAt || i.date, kind: 'invoice', title: i.id + ' · ' + i.label + ' · ' + i.status, amount: i.amount, currency: i.currency, ref: i.id }); });
  (src.payments || []).forEach((p) => out.push({ id: 'p:' + p.id, at: p.date || p.created, kind: 'payment', title: p.invoiceId + (p.ref ? ' · ' + p.ref : ''), amount: p.amount, currency: p.currency, by: p.by, inbound: true, ref: p.invoiceId }));
  (src.notes || []).forEach((n) => out.push({ id: 'n:' + n.id, at: n.at, kind: 'note', title: n.text, by: n.by }));
  return out.filter((x) => !isNaN(Date.parse(x.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
}

/** Filter groups shown as chips above the timeline. */
export const TL_GROUPS: Record<string, TLKind[]> = {
  talk: ['call', 'whatsapp', 'email', 'meeting'],
  money: ['quote', 'invoice', 'payment'],
  notes: ['note'],
  stage: ['stage', 'system']
};
export function filterTimeline(items: TLItem[], group: string): TLItem[] {
  const kinds = TL_GROUPS[group];
  return kinds ? items.filter((i) => kinds.includes(i.kind)) : items;
}

/** Items grouped by Riyadh day (yyyy-mm-dd), keeping the order. */
export function groupByDay(items: TLItem[]): { day: string; items: TLItem[] }[] {
  const out: { day: string; items: TLItem[] }[] = [];
  items.forEach((i) => {
    const day = new Date(Date.parse(i.at) + 3 * 3600e3).toISOString().slice(0, 10);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(i); else out.push({ day, items: [i] });
  });
  return out;
}
