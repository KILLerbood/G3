/** Onboarding checklists and projects / deliverables per client. Pure helpers; the data lives on this device. */
export type CheckItem = { id: string; title: string; done: boolean; doneAt?: string };
export type Deliverable = { id: string; title: string; due: string; done: boolean };
export type Project = { id: string; leadId: string; name: string; due: string; status: 'planned' | 'active' | 'review' | 'delivered'; deliverables: Deliverable[] };

export const ONBOARDING_TEMPLATE: [string, string][] = [
  ['اجتماع البداية (Kick-off) واتفقنا على الأهداف', 'Kick-off meeting and goals agreed'],
  ['استلمنا الدخول على الحسابات (إنستجرام، ميتا، الموقع)', 'Account access received (Instagram, Meta, site)'],
  ['العقد اتمضى وأول دفعة وصلت', 'Contract signed, first payment received'],
  ['جروب واتساب مع العميل اتعمل', 'Client WhatsApp group created'],
  ['خطة أول 30 يوم اتبعتت', 'First-30-days plan sent'],
  ['تتبع التحويلات (Pixel / GA) شغال', 'Conversion tracking (Pixel / GA) live'],
  ['أول تقرير أسبوعي اتبعت', 'First weekly report sent']
];
export const newChecklist = (lang: 'ar' | 'en' = 'ar'): CheckItem[] => ONBOARDING_TEMPLATE.map(([ar, en], i) => ({ id: 'c' + (i + 1), title: lang === 'ar' ? ar : en, done: false }));

export function progress(items: { done: boolean }[]): { done: number; total: number; pct: number } {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}
export function toggle<T extends { id: string; done: boolean; doneAt?: string }>(items: T[], id: string, at: string): T[] {
  return items.map((i) => (i.id === id ? { ...i, done: !i.done, doneAt: !i.done ? at : undefined } : i));
}
/** A project's status follows its deliverables unless it was explicitly put in review. */
export function projectStatus(p: Pick<Project, 'status' | 'deliverables'>): Project['status'] {
  const { done, total } = progress(p.deliverables);
  if (total && done === total) return 'delivered';
  if (p.status === 'review') return 'review';
  return done > 0 ? 'active' : p.status === 'active' ? 'active' : 'planned';
}
/** Deliverables not done whose due day is before today (yyyy-mm-dd). */
export const lateDeliverables = (projects: Project[], today: string) =>
  projects.flatMap((p) => p.deliverables.filter((d) => !d.done && d.due && d.due < today).map((d) => ({ project: p, d })));
