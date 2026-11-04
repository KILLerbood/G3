import { describe, expect, it } from 'vitest';
import { aging, daysOverdue, dealFlow, fillReminder, REMINDERS, suggestReminder, type Contract } from '../flow';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const inv = (id: string, p: Record<string, unknown> = {}) => ({ id, quoteId: 'Q1', status: 'اتبعت', amount: 1000, balance: 1000, dueDate: ago(0), overdue: false, currency: 'SAR', leadId: 'L', leadName: 'B', label: 'x', ...p });
const contract = (status: Contract['status']): Contract => ({ id: 'C1', quoteId: 'Q1', leadId: 'L', status, startDate: '2026-11-01', months: 12 });

describe('deal flow', () => {
  it('walks quote → contract → invoice → payment → done', () => {
    expect(dealFlow({ id: 'Q1', status: 'اتبعت' }, null, []).at).toBe('quote');
    expect(dealFlow({ id: 'Q1', status: 'اتوافق عليه' }, null, []).at).toBe('contract');
    expect(dealFlow({ id: 'Q1', status: 'اتوافق عليه' }, contract('sent'), []).at).toBe('contract');
    expect(dealFlow({ id: 'Q1', status: 'اتوافق عليه' }, contract('signed'), [inv('I1', { status: 'مسودة' })]).at).toBe('invoice');
    expect(dealFlow({ id: 'Q1', status: 'اتوافق عليه' }, contract('signed'), [inv('I1')]).at).toBe('payment');
    const done = dealFlow({ id: 'Q1', status: 'اتوافق عليه' }, contract('signed'), [inv('I1', { status: 'مدفوعة' }), inv('I2', { status: 'ملغية' })]);
    expect(done.at).toBe('done');
    expect(done.steps.every((s) => s.state === 'done')).toBe(true);
  });
  it('a rejected quote blocks the path', () => {
    expect(dealFlow({ id: 'Q1', status: 'اترفض' }, null, []).steps.map((s) => s.state)).toEqual(['blocked', 'todo', 'todo', 'todo']);
  });
});

describe('aging', () => {
  it('buckets unpaid sent invoices by days past due', () => {
    const a = aging([
      inv('a', { dueDate: ago(-5) }), inv('b', { dueDate: ago(10), balance: 400, status: 'مدفوعة جزئيًا' }), inv('c', { dueDate: ago(45) }),
      inv('d', { dueDate: ago(75) }), inv('e', { dueDate: ago(120) }), inv('f', { status: 'مدفوعة', balance: 0 }), inv('g', { status: 'مسودة' })
    ], NOW);
    expect(a.buckets.map((b) => b.count)).toEqual([1, 1, 1, 1, 1]);
    expect(a.total).toBe(4400);
    expect(a.overdue).toBe(3400);
    expect(a.buckets[1].items[0].days).toBe(10);
  });
  it('daysOverdue is never negative', () => {
    expect(daysOverdue(ago(-3), NOW)).toBe(0);
    expect(daysOverdue('', NOW)).toBe(0);
    expect(daysOverdue(ago(7), NOW)).toBe(7);
  });
});

describe('reminders', () => {
  it('suggests a tone by lateness', () => {
    expect(suggestReminder(0, 'wa')).toBe('wa-before');
    expect(suggestReminder(5, 'wa')).toBe('wa-friendly');
    expect(suggestReminder(30, 'wa')).toBe('wa-firm');
    expect(suggestReminder(60, 'wa')).toBe('wa-final');
    expect(suggestReminder(0, 'email')).toBe('em-friendly');
    expect(suggestReminder(90, 'email')).toBe('em-firm');
  });
  it('fills every placeholder in Arabic templates', () => {
    REMINDERS.forEach((r) => {
      const out = fillReminder(r, { name: 'محمد الغامدي', business: 'بيت الكنب', invoice: 'MGF-0007', amount: 'SAR 4,500', due: '1 نوفمبر', days: 12, link: 'https://x/d/1', sender: 'نور حسن' });
      expect(out.body).not.toMatch(/\{\{/);
      expect(out.subject).not.toMatch(/\{\{/);
    });
    expect(fillReminder(REMINDERS[1], { name: 'محمد الغامدي', business: '', invoice: 'MGF-1', amount: '1', due: 'x', days: 3, link: '', sender: '' }).body).toContain('أهلًا محمد،');
  });
});
