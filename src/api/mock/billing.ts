/* Demo-only port of the billing part of Api.gs (quotes → invoices → payments), so the money flow can be
   tried end to end in mock mode. Same function names, arguments and response shapes as the real backend.
   State lives in its own localStorage key and is seeded from the demo leads the first time. */
import { store } from '../../lib/storage';
import { DAY } from '../../lib/time';

type Row = Record<string, unknown>;
type Me = { email: string; name: string; isAdmin: boolean };
export type BillingHost = {
  leads: () => Row[];
  visibleLead: (me: Me, id: string) => Row;
  canSee: (me: Me, lead: Row) => boolean;
  log: (lead: Row, kind: string, direction: string, summary: string, details: string, by: string) => void;
  patchLead: (id: string, patch: Row) => void;
  fail: (msg: string) => never;
};

const KEY = 'g3-mock-billing-v1';
const s = (v: unknown) => (v == null ? '' : String(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (ms: number) => new Date(ms).toISOString();
const token = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);

type Item = { serviceId?: string; title: string; titleEn?: string; desc?: string; qty: number; unit: number; discountPct?: number; monthly?: boolean };
type Disc = { name: string; pct?: number; amount?: number; recurring?: boolean } | null;
type Plan = { label: string; pct: number; when?: string; date?: string };
type Data = { client: Row; items: Item[]; discount: Disc; plan: Plan[]; period: string; note: string; validDays: number; label?: string; voidReason?: string };
type BState = { quotes: Row[]; invoices: Row[]; payments: Row[]; services: Row[]; seq: { Q: number; MGF: number; P: number; S: number } };

const SETTINGS = {
  currency: 'SAR', autoSend: false, dueDays: 7, quoteDays: 14,
  from: { name: 'Magmafy OGP', line: 'Riyadh · KSA', email: 'billing@magmafy.com', whatsapp: '+966500000000', website: 'magmafy.com' },
  payment: { method: 'تحويل بنكي', beneficiary: 'Magmafy OGP', iban: 'SA00 0000 0000 0000 0000 0000', swift: 'RJHISARI' },
  termsQuote: [['العرض صالح للمدة المذكورة فوق.', 'This quote is valid for the period above.'], ['الأسعار لا تشمل ضريبة القيمة المضافة.', 'Prices exclude VAT.']] as [string, string][],
  termsInvoice: [['السداد خلال 7 أيام من تاريخ الفاتورة.', 'Payment due within 7 days.'], ['اكتب رقم الفاتورة في وصف التحويل.', 'Put the invoice number in the transfer note.']] as [string, string][]
};

const SERVICES: Row[] = [
  { id: 'S-01', nameAr: 'باقة المحتوى والإعلانات', nameEn: 'Content & ads', desc: '12 بوست + 4 ريلز + إدارة الإعلانات', price: 6000, billing: 'شهري', active: true },
  { id: 'S-02', nameAr: 'معرض 3D تفاعلي', nameEn: '3D showroom', desc: 'تصوير وبناء جولة 3D للمعرض', price: 18000, billing: 'مرة واحدة', active: true },
  { id: 'S-03', nameAr: 'دراسة السوق', nameEn: 'Market research', desc: 'تحليل المنافسين والجمهور', price: 9500, billing: 'مرة واحدة', active: true },
  { id: 'S-04', nameAr: 'استشارة نمو', nameEn: 'Growth consulting', desc: 'جلستين في الشهر', price: 2500, billing: 'شهري', active: true },
  { id: 'S-05', nameAr: 'إعداد وتجهيز الحساب', nameEn: 'Onboarding setup', desc: 'تجهيز الحسابات والتتبع', price: 3500, billing: 'مرة واحدة', active: true }
];

export function totals(items: Item[], discount: Disc) {
  let sub = 0;
  items.forEach((it) => { const g = r2(it.qty * it.unit); sub += r2(g - (g * Math.min(100, Math.max(0, it.discountPct || 0))) / 100); });
  sub = r2(sub);
  const d = !discount ? 0 : r2(Math.min(sub, discount.pct ? (sub * discount.pct) / 100 : Math.max(0, discount.amount || 0)));
  return r2(sub - d);
}
function planAmounts(total: number, plan: Plan[]) {
  const out = plan.map((p) => r2((total * p.pct) / 100));
  const diff = r2(total - out.reduce((a, b) => a + b, 0));
  if (out.length) out[out.length - 1] = r2(out[out.length - 1] + diff);
  return out;
}

function seed(leads: Row[]): BState {
  const st: BState = { quotes: [], invoices: [], payments: [], services: SERVICES.map((x) => ({ ...x })), seq: { Q: 0, MGF: 0, P: 0, S: SERVICES.length } };
  const now = Date.now();
  const dataOf = (l: Row, items: Item[], plan: Plan[]): Data => ({
    client: { business: s(l.business), contact: s(l.name), city: s(l.city), email: s(l.email), phone: s(l.phone) }, items, discount: null, plan, period: '', note: '', validDays: 14
  });
  const q = (l: Row, items: Item[], plan: Plan[], status: string, ageDays: number): Row => {
    const total = totals(items, null);
    const monthly = totals(items.filter((i) => i.monthly), null);
    const row: Row = {
      id: 'Q-' + String(++st.seq.Q).padStart(4, '0'), date: iso(now - ageDays * DAY), leadId: s(l.id), leadName: s(l.business || l.name), status, total, monthly,
      currency: 'SAR', validUntil: iso(now + (14 - ageDays) * DAY), sentAt: status === 'مسودة' ? '' : iso(now - (ageDays - 1) * DAY), openedAt: ['اتفتح', 'اتوافق عليه'].includes(status) ? iso(now - (ageDays - 2) * DAY) : '',
      decidedAt: status === 'اتوافق عليه' ? iso(now - (ageDays - 3) * DAY) : '', rejectReason: '', subscription: status === 'اتوافق عليه' && monthly > 0 ? 'نشط' : '', nextMonthly: '', by: s(l.owner) || 'عبد الله', token: token(), data: dataOf(l, items, plan)
    };
    st.quotes.push(row);
    return row;
  };
  const inv = (quote: Row, label: string, amount: number, status: string, ageDays: number, dueInDays: number, paid = 0, ref = ''): void => {
    const id = 'MGF-' + String(++st.seq.MGF).padStart(4, '0');
    const sent = status !== 'مجدولة' && status !== 'مسودة';
    st.invoices.push({
      id, date: iso(now - ageDays * DAY), leadId: quote.leadId, leadName: quote.leadName, quoteId: quote.id, label, status, amount, paid, balance: r2(amount - paid), currency: 'SAR',
      dueDate: iso(now + dueInDays * DAY), readyOn: iso(now - ageDays * DAY), sentAt: sent ? iso(now - ageDays * DAY) : '', by: quote.by, token: token(), lastReminder: '',
      data: { ...(quote.data as Data), label }
    });
    if (paid > 0) {
      st.payments.push({ id: 'P-' + String(++st.seq.P).padStart(4, '0'), created: iso(now - (ageDays - 2) * DAY), date: iso(now - (ageDays - 2) * DAY), invoiceId: id, leadId: quote.leadId, leadName: quote.leadName, amount: paid, currency: 'SAR', method: 'تحويل بنكي', ref: ref || 'TRX' + (1000 + st.seq.P * 7), fromName: s((quote.data as Data).client.contact), fromAccount: '', note: '', fileId: '', by: quote.by });
    }
  };
  const content: Item = { serviceId: 'S-01', title: 'باقة المحتوى والإعلانات', qty: 1, unit: 6000, monthly: true };
  const consult: Item = { serviceId: 'S-04', title: 'استشارة نمو', qty: 1, unit: 2500, monthly: true };
  const setup: Item = { serviceId: 'S-05', title: 'إعداد وتجهيز الحساب', qty: 1, unit: 3500 };
  const show3d: Item = { serviceId: 'S-02', title: 'معرض 3D تفاعلي', qty: 1, unit: 18000 };
  const research: Item = { serviceId: 'S-03', title: 'دراسة السوق', qty: 1, unit: 9500 };
  let k = 0;
  leads.forEach((l) => {
    const stage = s(l.stage);
    if (stage === 'عميل نشط') {
      k++;
      const items = k % 2 ? [setup, content] : [setup, consult, show3d];
      const quote = q(l, items, [{ label: 'الدفعة الأولى', pct: 50, when: 'عند الموافقة' }, { label: 'الدفعة الثانية', pct: 50, when: 'بعد 30 يوم' }], 'اتوافق عليه', 70 + k * 6);
      const [a, b] = planAmounts(Number(quote.total), (quote.data as Data).plan);
      inv(quote, 'الدفعة الأولى', a, 'مدفوعة', 64 + k * 6, -57 - k * 6, a);
      // A spread of receivables for the aging view: paid, partly paid, overdue by different amounts, not due yet.
      const shapes: [string, number, number, number][] = [['مدفوعة', 30, -23, b], ['مدفوعة جزئيًا', 40, -12, r2(b * 0.4)], ['اتبعت', 50, -38, 0], ['اتبعت', 9, 5, 0], ['اتبعت', 95, -75, 0], ['مدفوعة جزئيًا', 20, -3, r2(b * 0.5)]];
      const [st2, age, due, paid] = shapes[(k - 1) % shapes.length];
      inv(quote, 'الدفعة الثانية', b, st2, age, due, paid);
      const monthly = Number(quote.monthly) || 0;
      if (monthly) inv(quote, 'اشتراك ' + new Date(now).toLocaleDateString('ar-EG', { month: 'long' }), monthly, k % 3 ? 'اتبعت' : 'مسودة', 3, 4);
    } else if (stage === 'عرض مرسل') {
      q(l, [research, setup], [{ label: 'الدفعة الكاملة', pct: 100, when: 'عند الموافقة' }], 'اتبعت', 4);
    } else if (stage === 'تفاوض') {
      q(l, [setup, content, show3d], [{ label: 'الدفعة الأولى', pct: 40, when: 'عند الموافقة' }, { label: 'الدفعة الثانية', pct: 60, when: 'عند التسليم' }], 'اتفتح', 6);
    } else if (stage === 'فترة تجريبية') {
      q(l, [consult], [{ label: 'الدفعة الكاملة', pct: 100, when: 'عند الموافقة' }], 'مسودة', 1);
    }
  });
  return st;
}

export function createBillingApi(host: BillingHost) {
  let st: BState = store.json<BState | null>(KEY, null) || seed(host.leads());
  const save = () => store.setJson(KEY, st);
  save();
  const link = (tok: unknown) => location.origin + location.pathname + '#/d/' + s(tok);
  const overdue = (i: Row) => ['اتبعت', 'مدفوعة جزئيًا'].includes(s(i.status)) && Number(i.balance) > 0 && !!i.dueDate && Date.parse(s(i.dueDate)) + DAY <= Date.now();
  const qView = (q: Row) => { const v: Row = { ...q, link: link(q.token) }; delete v.token; return v; };
  const iView = (i: Row) => { const v: Row = { ...i, link: link(i.token), overdue: overdue(i) }; delete v.token; delete v.lastReminder; return v; };
  const findQ = (id: string) => st.quotes.find((x) => x.id === id) || host.fail('العرض مش موجود');
  const findI = (id: string) => st.invoices.find((x) => x.id === id) || host.fail('الفاتورة مش موجودة');
  const ddmmyyyy = (v: unknown) => { const d = new Date(s(v)); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB'); };
  const refresh = (inv: Row) => {
    const paid = r2(st.payments.filter((p) => p.invoiceId === inv.id).reduce((a, p) => a + Number(p.amount), 0));
    const balance = r2(Math.max(0, Number(inv.amount) - paid));
    let status = s(inv.status);
    if (status !== 'ملغية') status = paid <= 0 ? (inv.sentAt ? 'اتبعت' : status === 'مجدولة' ? 'مجدولة' : 'مسودة') : balance <= 0 ? 'مدفوعة' : 'مدفوعة جزئيًا';
    Object.assign(inv, { paid, balance, status });
  };
  const quoteDoc = (q: Row) => {
    const d = q.data as Data;
    return { kind: 'quote', number: q.id, issueDate: ddmmyyyy(q.sentAt || q.date), dueDate: ddmmyyyy(q.validUntil), period: d.period, currency: q.currency, client: d.client, from: SETTINGS.from, items: d.items, discount: d.discount, plan: d.plan, payment: SETTINGS.payment, terms: SETTINGS.termsQuote, note: d.note };
  };
  const invDoc = (i: Row) => {
    const d = i.data as Data;
    const pays = st.payments.filter((p) => p.invoiceId === i.id);
    return { kind: 'invoice', number: i.id, issueDate: ddmmyyyy(i.sentAt || i.date), dueDate: ddmmyyyy(i.dueDate), period: d.period, currency: i.currency, client: d.client, from: SETTINGS.from, items: d.items, discount: d.discount, dueAmount: Number(i.amount), payment: SETTINGS.payment, terms: SETTINGS.termsInvoice, note: d.note, payments: pays.map((p) => ({ date: ddmmyyyy(p.date), amount: Number(p.amount), ref: p.ref, from: p.fromName })) };
  };
  const accept = (q: Row, me: Me, how: string) => {
    const d = q.data as Data;
    const amounts = planAmounts(Number(q.total), d.plan);
    d.plan.forEach((p, i) => {
      const id = 'MGF-' + String(++st.seq.MGF).padStart(4, '0');
      const date = p.date ? new Date(p.date).toISOString() : '';
      st.invoices.unshift({ id, date: iso(Date.now()), leadId: q.leadId, leadName: q.leadName, quoteId: q.id, label: p.label, status: i === 0 ? 'مسودة' : 'مجدولة', amount: amounts[i], paid: 0, balance: amounts[i], currency: q.currency, dueDate: date, readyOn: i === 0 ? iso(Date.now()) : '', sentAt: '', by: me.name, token: token(), data: { ...d, label: p.label } });
    });
    const monthly = Number(q.monthly) || 0;
    Object.assign(q, { status: 'اتوافق عليه', decidedAt: iso(Date.now()), subscription: monthly > 0 ? 'نشط' : '' });
    const lead = host.visibleLead(me, s(q.leadId));
    const patch: Row = { dealValue: q.total };
    if (monthly > 0) patch.mrr = monthly;
    host.patchLead(s(lead.id), patch);
    host.log(lead, 'مالية', 'وارد', 'اتوافق على العرض ' + q.id + ' (' + how + ')', '', me.name);
  };

  const api: Record<string, (me: Me, ...a: never[]) => unknown> = {
    crmServices: () => st.services,
    crmSaveService: (me: Me, x: Row) => {
      if (!me.isAdmin) host.fail('الخدمات للأدمن بس');
      if (!s(x.nameAr).trim()) host.fail('اكتب اسم الخدمة');
      const row = { nameAr: s(x.nameAr), nameEn: s(x.nameEn), desc: s(x.desc), price: Math.max(0, r2(Number(x.price))), billing: x.billing === 'شهري' ? 'شهري' : 'مرة واحدة', active: x.active !== false };
      const old = x.id ? st.services.find((r) => r.id === x.id) : null;
      if (old) Object.assign(old, row); else st.services.push({ id: 'S-' + String(++st.seq.S).padStart(2, '0'), ...row });
      save();
      return { ok: true, services: st.services };
    },
    crmBilling: (me: Me, q: Row) => {
      const leadId = s(q?.leadId);
      if (leadId) host.visibleLead(me, leadId);
      const vis = new Set(host.leads().filter((l) => host.canSee(me, l)).map((l) => s(l.id)));
      const can = (id: unknown) => (leadId ? id === leadId : vis.has(s(id)));
      const byDate = (k: string) => (a: Row, b: Row) => Date.parse(s(b[k])) - Date.parse(s(a[k]));
      return {
        quotes: st.quotes.filter((r) => can(r.leadId)).sort(byDate('date')).map(qView),
        invoices: st.invoices.filter((r) => can(r.leadId)).sort(byDate('date')).map(iView),
        payments: st.payments.filter((r) => can(r.leadId)).sort(byDate('created')),
        settings: SETTINGS
      };
    },
    crmBillingDoc: (me: Me, kind: string, id: string) => {
      if (kind === 'quote') { const q = findQ(id); host.visibleLead(me, s(q.leadId)); return { doc: quoteDoc(q), status: q.status }; }
      const i = findI(id); host.visibleLead(me, s(i.leadId)); return { doc: invDoc(i), status: i.status };
    },
    crmSaveQuote: (me: Me, x: Row) => {
      const lead = host.visibleLead(me, s(x.leadId));
      const items = ((x.items as Item[]) || []).filter((i) => s(i.title).trim()).map((i) => ({ ...i, qty: Number(i.qty) || 0, unit: Number(i.unit) || 0 }));
      const discount = (x.discount as Disc) || null;
      const plan = ((x.plan as Plan[]) || []).filter((p) => Number(p.pct) > 0);
      const total = totals(items, discount);
      if (total <= 0) host.fail('إجمالي العرض لازم يبقى أكبر من صفر');
      const monthly = totals(items.filter((i) => i.monthly), discount?.recurring ? discount : null);
      const data: Data = { client: (x.client as Row) || {}, items, discount, plan, period: s(x.period), note: s(x.note), validDays: Number(x.validDays) || 14 };
      let q: Row;
      if (x.id) {
        q = findQ(s(x.id));
        if (q.status !== 'مسودة') host.fail('العرض اتبعت خلاص ومينفعش يتعدّل. اعمل عرض جديد');
        Object.assign(q, { total, monthly, data });
      } else {
        q = { id: 'Q-' + String(++st.seq.Q).padStart(4, '0'), date: iso(Date.now()), leadId: lead.id, leadName: s(lead.business || lead.name), status: 'مسودة', total, monthly, currency: 'SAR', validUntil: iso(Date.now() + data.validDays * DAY), sentAt: '', openedAt: '', decidedAt: '', rejectReason: '', subscription: '', nextMonthly: '', by: me.name, token: token(), data };
        st.quotes.unshift(q);
      }
      if (x.direct) accept(q, me, 'فاتورة مباشرة');
      save();
      return { ok: true, quote: qView(q), invoices: st.invoices.filter((i) => i.quoteId === q.id).map(iView) };
    },
    crmSendDoc: (me: Me, kind: string, id: string, channel: string) => {
      const rec = kind === 'quote' ? findQ(id) : findI(id);
      const lead = host.visibleLead(me, s(rec.leadId));
      if (kind === 'quote' && ['اتوافق عليه', 'اترفض', 'انتهى'].includes(s(rec.status))) host.fail('العرض ده ' + rec.status);
      if (kind === 'invoice' && ['ملغية', 'مجدولة'].includes(s(rec.status))) host.fail(rec.status === 'مجدولة' ? 'الفاتورة لسه مجدولة، جهّزها الأول' : 'الفاتورة ملغية');
      if (channel === 'email' && !/@/.test(s((rec.data as Data).client.email || lead.email))) host.fail('العميل مالوش إيميل صحيح. اكتبه في بيانات العميل أو ابعت على الواتساب');
      if (rec.status === 'مسودة') rec.status = 'اتبعت';
      if (!rec.sentAt) { rec.sentAt = iso(Date.now()); if (kind === 'invoice' && !rec.dueDate) rec.dueDate = iso(Date.now() + SETTINGS.dueDays * DAY); }
      host.log(lead, 'مالية', 'صادر', 'اتبعت ' + (kind === 'quote' ? 'عرض سعر ' : 'فاتورة ') + rec.id + (channel === 'email' ? ' بالإيميل' : channel === 'whatsapp' ? ' على الواتساب' : ''), link(rec.token), me.name);
      if (kind === 'quote' && ['جديد', 'تم التواصل', 'اجتماع محجوز', 'تم الاجتماع'].includes(s(lead.stage))) host.patchLead(s(lead.id), { stage: 'عرض مرسل' });
      save();
      return { ok: true, link: link(rec.token), item: kind === 'quote' ? qView(rec) : iView(rec) };
    },
    crmDecideQuote: (me: Me, id: string, decision: string, reason: string) => {
      const q = findQ(id);
      const lead = host.visibleLead(me, s(q.leadId));
      if (!['مسودة', 'اتبعت', 'اتفتح'].includes(s(q.status))) host.fail('العرض ده ' + q.status);
      if (decision === 'reject') {
        if (!s(reason).trim()) host.fail('اكتب سبب الرفض');
        Object.assign(q, { status: 'اترفض', decidedAt: iso(Date.now()), rejectReason: s(reason) });
        host.log(lead, 'مالية', 'وارد', 'العميل رفض العرض ' + q.id + ': ' + reason, '', me.name);
      } else accept(q, me, 'وافق (اتسجل من الفريق)');
      save();
      return { ok: true, quote: qView(q), invoices: st.invoices.filter((i) => i.quoteId === id).map(iView) };
    },
    crmPrepareInvoice: (me: Me, id: string, due: string) => {
      const i = findI(id); host.visibleLead(me, s(i.leadId));
      if (i.status !== 'مجدولة') host.fail('الفاتورة جاهزة خلاص');
      Object.assign(i, { status: 'مسودة', readyOn: iso(Date.now()), dueDate: due ? new Date(due).toISOString() : i.dueDate });
      save();
      return { ok: true, invoice: iView(i) };
    },
    crmUpdateInvoice: (me: Me, id: string, p: Row) => {
      const i = findI(id); host.visibleLead(me, s(i.leadId));
      if (['مدفوعة', 'ملغية'].includes(s(i.status))) host.fail('الفاتورة ' + i.status);
      if (p && 'dueDate' in p) i.dueDate = new Date(s(p.dueDate)).toISOString();
      if (p && 'note' in p) (i.data as Data).note = s(p.note);
      save();
      return { ok: true, invoice: iView(i) };
    },
    crmVoidInvoice: (me: Me, id: string, reason: string) => {
      if (!me.isAdmin) host.fail('إلغاء الفواتير للأدمن بس');
      if (!s(reason).trim()) host.fail('اكتب سبب الإلغاء');
      const i = findI(id);
      if (Number(i.paid) > 0) host.fail('الفاتورة عليها مدفوعات. امسح الدفعات الأول لو اتسجلت غلط');
      i.status = 'ملغية'; (i.data as Data).voidReason = s(reason);
      save();
      return { ok: true, invoice: iView(i) };
    },
    crmStopSubscription: (me: Me, id: string) => {
      const q = findQ(id); const lead = host.visibleLead(me, s(q.leadId));
      Object.assign(q, { subscription: 'متوقف', nextMonthly: '' });
      host.patchLead(s(lead.id), { mrr: 0 });
      host.log(lead, 'مالية', 'صادر', 'وقف الاشتراك الشهري (' + q.id + ')', '', me.name);
      save();
      return { ok: true, quote: qView(q) };
    },
    crmRecordPayment: (me: Me, id: string, p: Row) => {
      const i = findI(id); const lead = host.visibleLead(me, s(i.leadId));
      if (['ملغية', 'مدفوعة'].includes(s(i.status))) host.fail('الفاتورة ' + i.status);
      const amount = r2(Number(p.amount));
      if (!(amount > 0)) host.fail('اكتب المبلغ');
      if (amount > Number(i.balance) + 0.001) host.fail('المبلغ أكبر من المتبقي (' + i.balance + '). سجّل الزيادة على الفاتورة الجاية');
      const ref = s(p.ref).trim();
      if (ref && !p.force && st.payments.some((x) => s(x.ref) === ref)) host.fail('رقم التحويل ده اتسجل قبل كده');
      st.payments.unshift({ id: 'P-' + String(++st.seq.P).padStart(4, '0'), created: iso(Date.now()), date: p.date ? new Date(s(p.date)).toISOString() : iso(Date.now()), invoiceId: i.id, leadId: i.leadId, leadName: i.leadName, amount, currency: i.currency, method: s(p.method) || 'تحويل بنكي', ref, fromName: s(p.fromName), fromAccount: s(p.fromAccount), note: s(p.note), fileId: '', by: me.name });
      if (!i.sentAt) i.sentAt = iso(Date.now());
      refresh(i);
      host.log(lead, 'مالية', 'وارد', 'دفعة ' + i.currency + ' ' + amount + ' على ' + i.id + (ref ? ' · ' + ref : ''), 'المتبقي ' + i.currency + ' ' + i.balance, me.name);
      save();
      return { ok: true, invoice: iView(i), emailed: false, emailError: '' };
    },
    crmDeletePayment: (me: Me, id: string) => {
      if (!me.isAdmin) host.fail('مسح الدفعات للأدمن بس');
      const p = st.payments.find((x) => x.id === id) || host.fail('الدفعة مش موجودة');
      st.payments = st.payments.filter((x) => x !== p);
      const i = st.invoices.find((x) => x.id === p.invoiceId);
      if (i) refresh(i);
      save();
      return { ok: true };
    }
  };

  /** The client's public page (#/d/:token): view, or accept a quote. */
  function publicDoc(op: string, tok: string, name: string) {
    const q = st.quotes.find((x) => x.token === tok);
    const i = q ? null : st.invoices.find((x) => x.token === tok);
    if (!q && !i) return { ok: false, error: 'not_found' };
    if (q) {
      if (op === 'accept') {
        if (!['اتبعت', 'اتفتح'].includes(s(q.status))) return { ok: false, error: 'closed', status: q.status };
        accept(q, { email: '', name: name || 'العميل', isAdmin: true }, 'وافق من الرابط');
      } else if (q.status === 'اتبعت') { q.status = 'اتفتح'; q.openedAt = iso(Date.now()); }
      save();
      return { ok: true, data: { kind: 'quote', status: q.status, canAccept: ['اتبعت', 'اتفتح'].includes(s(q.status)), doc: quoteDoc(q) } };
    }
    return { ok: true, data: { kind: 'invoice', status: i!.status, canAccept: false, doc: invDoc(i!) } };
  }
  return { api, publicDoc, reset: () => { st = seed(host.leads()); save(); } };
}
