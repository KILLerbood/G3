/**
 * The money path of a deal: quote → contract → invoice → payment. Aging of receivables, and the Arabic
 * reminder templates (WhatsApp / email). Pure.
 */
export type Contract = { id: string; quoteId: string; leadId: string; status: 'draft' | 'sent' | 'signed'; startDate: string; months: number; signedAt?: string; signer?: string };
type Q = { id: string; status: string };
type I = { id: string; quoteId: string; status: string; amount: number; balance: number | null; dueDate: string; overdue: boolean; currency: string; leadId: string; leadName: string; label: string; sentAt?: string };

export type StepState = 'done' | 'current' | 'todo' | 'blocked';
export type FlowKey = 'quote' | 'contract' | 'invoice' | 'payment';
export const FLOW_LABEL: Record<FlowKey, [string, string]> = { quote: ['عرض السعر', 'Quote'], contract: ['العقد', 'Contract'], invoice: ['الفاتورة', 'Invoice'], payment: ['الدفع', 'Payment'] };

/** Where a deal stands on the money path. */
export function dealFlow(quote: Q | null, contract: Contract | null, invoices: I[]): { at: FlowKey | 'done'; steps: { key: FlowKey; state: StepState }[] } {
  const live = invoices.filter((i) => i.status !== 'ملغية' && (!quote || i.quoteId === quote.id));
  const accepted = quote?.status === 'اتوافق عليه';
  const rejected = quote && ['اترفض', 'انتهى'].includes(quote.status);
  const signed = contract?.status === 'signed';
  const issued = live.some((i) => !['مجدولة', 'مسودة'].includes(i.status));
  const allPaid = live.length > 0 && live.every((i) => i.status === 'مدفوعة');
  let at: FlowKey | 'done' = 'quote';
  if (accepted) at = signed ? (issued ? (allPaid ? 'done' : 'payment') : 'invoice') : 'contract';
  const order: FlowKey[] = ['quote', 'contract', 'invoice', 'payment'];
  const idx = at === 'done' ? 4 : order.indexOf(at);
  return { at, steps: order.map((key, i) => ({ key, state: rejected ? (i === 0 ? 'blocked' : 'todo') : i < idx ? 'done' : i === idx ? 'current' : 'todo' })) };
}

export const daysOverdue = (dueDate: string, now: number) => { const d = Date.parse(dueDate); return isNaN(d) ? 0 : Math.max(0, Math.floor((now - d) / 864e5)); };

export type BucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90';
export const BUCKET_LABEL: Record<BucketKey, [string, string]> = { current: ['لسه مستحقتش', 'Not due'], d1_30: ['1–30 يوم', '1–30 days'], d31_60: ['31–60 يوم', '31–60 days'], d61_90: ['61–90 يوم', '61–90 days'], d90: ['أكتر من 90', '90+ days'] };
/** Receivables by age: every sent, unpaid invoice with a balance. */
export function aging(invoices: I[], now: number) {
  const keys: BucketKey[] = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90'];
  const buckets = keys.map((key) => ({ key, total: 0, count: 0, items: [] as (I & { days: number })[] }));
  invoices.filter((i) => ['اتبعت', 'مدفوعة جزئيًا'].includes(i.status) && (i.balance ?? i.amount) > 0).forEach((i) => {
    const days = daysOverdue(i.dueDate, now);
    const k = days === 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    const b = buckets[k];
    b.total += i.balance ?? i.amount; b.count++; b.items.push({ ...i, days });
  });
  buckets.forEach((b) => b.items.sort((x, y) => y.days - x.days));
  const total = buckets.reduce((a, b) => a + b.total, 0);
  return { buckets, total, overdue: total - buckets[0].total };
}

export type Reminder = { id: string; channel: 'wa' | 'email'; tone: 'friendly' | 'firm' | 'final' | 'before'; name: [string, string]; subject?: string; body: string };
/** Natural Egyptian Arabic, polite with the client. {{vars}} are filled by fillReminder. */
export const REMINDERS: Reminder[] = [
  { id: 'wa-before', channel: 'wa', tone: 'before', name: ['قبل الميعاد (واتساب)', 'Before due (WhatsApp)'], body: 'أهلًا {{الاسم}} 👋\nبفكّرك إن فاتورة {{الفاتورة}} بمبلغ {{المبلغ}} ميعادها {{الاستحقاق}}.\nتقدر تشوفها وتحمّلها من هنا: {{الرابط}}\nلو محتاج أي حاجة أنا موجود. {{المرسل}}' },
  { id: 'wa-friendly', channel: 'wa', tone: 'friendly', name: ['تذكير ودّي (واتساب)', 'Friendly reminder (WhatsApp)'], body: 'أهلًا {{الاسم}}، إزيك؟\nحبيت أفكّرك بفاتورة {{الفاتورة}} ({{المبلغ}}) اللي كان ميعادها {{الاستحقاق}}، فاتت بـ {{الأيام}} يوم.\nلو الدفعة اتحولت ابعتلي صورة التحويل وأنا أسجلها فورًا 🙏\n{{الرابط}}' },
  { id: 'wa-firm', channel: 'wa', tone: 'firm', name: ['متابعة جادة (واتساب)', 'Firm follow-up (WhatsApp)'], body: 'أهلًا {{الاسم}}،\nفاتورة {{الفاتورة}} بمبلغ {{المبلغ}} متأخرة {{الأيام}} يوم. محتاجين نقفلها الأسبوع ده عشان الشغل يكمل من غير توقف.\nممكن تقولي ميعاد التحويل المتوقع؟\n{{الرابط}}' },
  { id: 'wa-final', channel: 'wa', tone: 'final', name: ['آخر تذكير (واتساب)', 'Final notice (WhatsApp)'], body: 'أهلًا {{الاسم}}،\nده آخر تذكير بفاتورة {{الفاتورة}} ({{المبلغ}}) المتأخرة {{الأيام}} يوم.\nلو مفيش تحويل خلال 3 أيام، هنضطر نوقف الخدمة مؤقتًا لحد السداد. يهمنا نكمل مع {{النشاط}}، فكلمني لو فيه أي ظرف ونتفق سوا.\n{{المرسل}}' },
  { id: 'em-friendly', channel: 'email', tone: 'friendly', name: ['تذكير ودّي (إيميل)', 'Friendly reminder (email)'], subject: 'تذكير بفاتورة {{الفاتورة}} · {{النشاط}}', body: 'أهلًا {{الاسم}}،\n\nتذكير بسيط بفاتورة {{الفاتورة}} بمبلغ {{المبلغ}}، وكان ميعاد استحقاقها {{الاستحقاق}}.\nتقدر تراجع الفاتورة وتحمّل نسخة PDF من الرابط:\n{{الرابط}}\n\nلو الدفعة اتحولت خلاص، رد على الإيميل ده برقم التحويل ونسجلها.\n\nتحياتي،\n{{المرسل}}' },
  { id: 'em-firm', channel: 'email', tone: 'firm', name: ['متابعة جادة (إيميل)', 'Firm follow-up (email)'], subject: 'فاتورة {{الفاتورة}} متأخرة {{الأيام}} يوم', body: 'أهلًا {{الاسم}}،\n\nفاتورة {{الفاتورة}} بمبلغ {{المبلغ}} متأخرة {{الأيام}} يوم عن ميعادها ({{الاستحقاق}}).\nياريت تأكدلنا ميعاد التحويل خلال يومين عشان نخطط الشغل الجاي لـ {{النشاط}}.\n\n{{الرابط}}\n\nتحياتي،\n{{المرسل}}' }
];
export function suggestReminder(days: number, channel: 'wa' | 'email'): string {
  const tone = days <= 0 ? 'before' : days <= 14 ? 'friendly' : days <= 45 ? 'firm' : 'final';
  const pick = REMINDERS.find((r) => r.channel === channel && r.tone === tone) || REMINDERS.find((r) => r.channel === channel && r.tone === (tone === 'final' ? 'firm' : 'friendly'));
  return pick!.id;
}
export type ReminderVars = { name: string; business: string; invoice: string; amount: string; due: string; days: number; link: string; sender: string };
export function fillReminder(r: Pick<Reminder, 'subject' | 'body'>, v: ReminderVars): { subject: string; body: string } {
  const map: Record<string, string> = { 'الاسم': v.name.split(' ')[0] || v.name, 'النشاط': v.business, 'الفاتورة': v.invoice, 'المبلغ': v.amount, 'الاستحقاق': v.due, 'الأيام': String(v.days), 'الرابط': v.link, 'المرسل': v.sender };
  const fill = (s: string) => s.replace(/\{\{([^}]+)\}\}/g, (m, k: string) => (k.trim() in map ? map[k.trim()] : m));
  return { subject: fill(r.subject || ''), body: fill(r.body) };
}
