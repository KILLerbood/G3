/**
 * Follow-up sequences (cadences): a few steps spread over days, per lead or client.
 * Each step falls on a working day (KSA weekend: Friday, Saturday). A reply from the client stops the
 * sequence; done / skipped steps are remembered. Pure: dates are yyyy-mm-dd strings, «today» is passed in.
 */
export type Channel = 'wa' | 'email' | 'call' | 'task';
export type CadenceStep = { day: number; channel: Channel; title: string; body?: string };
export type Cadence = { id: string; name: string; audience: 'lead' | 'client'; steps: CadenceStep[] };
export type Enrollment = { id: string; cadenceId: string; leadId: string; start: string; done: number[]; skipped: number[]; stopped?: string; stopReason?: string };
export type StepState = 'done' | 'skipped' | 'overdue' | 'due' | 'upcoming' | 'stopped';
export type Scheduled = { index: number; step: CadenceStep; date: string; state: StepState };

export const WEEKEND = [5, 6]; // Friday, Saturday
const dow = (ymd: string) => new Date(ymd + 'T12:00:00Z').getUTCDay();
export const plusDays = (ymd: string, n: number) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
/** The same day if it is a working day, otherwise the next working day. */
export function workday(ymd: string, weekend = WEEKEND): string {
  let d = ymd;
  for (let i = 0; i < 7 && weekend.includes(dow(d)); i++) d = plusDays(d, 1);
  return d;
}

export function schedule(e: Enrollment, c: Cadence, today: string, weekend = WEEKEND): Scheduled[] {
  let prev = '';
  return c.steps.map((step, index) => {
    // Never two steps on the same day: a later step moves to the next working day after the previous one.
    let date = workday(plusDays(e.start, step.day), weekend);
    if (prev && date <= prev) date = workday(plusDays(prev, 1), weekend);
    prev = date;
    let state: StepState;
    if (e.done.includes(index)) state = 'done';
    else if (e.skipped.includes(index)) state = 'skipped';
    else if (e.stopped) state = 'stopped';
    else state = date < today ? 'overdue' : date === today ? 'due' : 'upcoming';
    return { index, step, date, state };
  });
}
export const isFinished = (e: Enrollment, c: Cadence) => !!e.stopped || c.steps.every((_, i) => e.done.includes(i) || e.skipped.includes(i));
/** The first open step, or null. */
export function nextOpen(e: Enrollment, c: Cadence, today: string): Scheduled | null {
  return schedule(e, c, today).find((s) => ['overdue', 'due', 'upcoming'].includes(s.state)) || null;
}
/** Everything to do today across all sequences (due today or overdue), oldest first. */
export function agenda(enrollments: Enrollment[], cadences: Cadence[], today: string): (Scheduled & { enrollment: Enrollment; cadence: Cadence })[] {
  const out: (Scheduled & { enrollment: Enrollment; cadence: Cadence })[] = [];
  enrollments.forEach((e) => {
    const c = cadences.find((x) => x.id === e.cadenceId);
    if (!c || e.stopped) return;
    const n = nextOpen(e, c, today);
    if (n && (n.state === 'due' || n.state === 'overdue')) out.push({ ...n, enrollment: e, cadence: c });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
/** A reply (inbound touch) after the sequence started stops it: the conversation is live now. */
export function replyStops(e: Enrollment, inboundAt: string[]): boolean {
  return !e.stopped && inboundAt.some((d) => d.slice(0, 10) >= e.start && !isNaN(Date.parse(d)));
}
export function mark(e: Enrollment, index: number, how: 'done' | 'skipped'): Enrollment {
  const done = e.done.filter((i) => i !== index), skipped = e.skipped.filter((i) => i !== index);
  return how === 'done' ? { ...e, done: [...done, index], skipped } : { ...e, done, skipped: [...skipped, index] };
}

export const DEFAULT_CADENCES: Cadence[] = [
  { id: 'cd-quote', name: 'متابعة بعد العرض', audience: 'lead', steps: [
    { day: 0, channel: 'wa', title: 'ابعت العرض على الواتساب ووضّح أهم نقطة', body: 'أهلًا {{الاسم}}، بعتلك العرض على الإيميل. أهم حاجة فيه إن التصوير والإعلانات في باقة واحدة. أي سؤال أنا هنا.' },
    { day: 2, channel: 'call', title: 'مكالمة قصيرة: وصلك العرض؟ فيه أسئلة؟' },
    { day: 5, channel: 'email', title: 'إيميل بقصة نجاح عميل شبهه', body: 'أهلًا {{الاسم}}، حبيت أشاركك إزاي معرض شبه {{النشاط}} زوّد زياراته 40% في شهرين.' },
    { day: 9, channel: 'wa', title: 'آخر متابعة: نقفل ولا نأجل؟', body: 'أهلًا {{الاسم}}، لو التوقيت مش مناسب دلوقتي قولي ونرجع نتكلم الشهر الجاي، من غير أي ضغط 🙏' }
  ] },
  { id: 'cd-onboard', name: 'تأهيل عميل جديد', audience: 'client', steps: [
    { day: 0, channel: 'email', title: 'إيميل ترحيب وتعريف بمدير الحساب' },
    { day: 1, channel: 'call', title: 'مكالمة البداية (Kick-off)' },
    { day: 7, channel: 'wa', title: 'اطمن: الأسبوع الأول ماشي إزاي؟' },
    { day: 30, channel: 'task', title: 'اجتماع مراجعة أول شهر ونتايجه' }
  ] },
  { id: 'cd-pay', name: 'تحصيل فاتورة متأخرة', audience: 'client', steps: [
    { day: 0, channel: 'wa', title: 'تذكير ودّي بالفاتورة (قالب واتساب)' },
    { day: 3, channel: 'email', title: 'إيميل متابعة بالرابط' },
    { day: 7, channel: 'call', title: 'مكالمة: ميعاد التحويل المتوقع؟' },
    { day: 14, channel: 'wa', title: 'آخر تذكير قبل إيقاف الخدمة' }
  ] },
  { id: 'cd-winback', name: 'إعادة تنشيط عميل متوقف', audience: 'client', steps: [
    { day: 0, channel: 'wa', title: 'رسالة: جهزنا أفكار للموسم الجاي' },
    { day: 4, channel: 'email', title: 'ابعت ملخص النتايج اللي حققناها سوا' },
    { day: 10, channel: 'call', title: 'مكالمة: عرض رجوع بخصم' }
  ] }
];
