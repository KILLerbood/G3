import { describe, expect, it } from 'vitest';
import { lateDeliverables, newChecklist, progress, projectStatus, toggle } from '../onboarding';

describe('onboarding', () => {
  it('new checklist starts empty, progress counts', () => {
    const c = newChecklist();
    expect(progress(c)).toEqual({ done: 0, total: 7, pct: 0 });
    const t = toggle(c, 'c1', '2026-11-03');
    expect(progress(t)).toEqual({ done: 1, total: 7, pct: 14 });
    expect(t[0].doneAt).toBe('2026-11-03');
    expect(toggle(t, 'c1', 'x')[0].doneAt).toBeUndefined();
    expect(progress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
  it('project status follows deliverables', () => {
    const d = (done: boolean) => ({ id: Math.random().toString(), title: 'x', due: '', done });
    expect(projectStatus({ status: 'planned', deliverables: [d(false)] })).toBe('planned');
    expect(projectStatus({ status: 'planned', deliverables: [d(true), d(false)] })).toBe('active');
    expect(projectStatus({ status: 'review', deliverables: [d(true), d(false)] })).toBe('review');
    expect(projectStatus({ status: 'active', deliverables: [d(true), d(true)] })).toBe('delivered');
  });
  it('lists late deliverables', () => {
    const p = { id: 'p', leadId: 'L', name: 'P', due: '', status: 'active' as const, deliverables: [{ id: 'a', title: 'a', due: '2026-11-01', done: false }, { id: 'b', title: 'b', due: '2026-11-01', done: true }, { id: 'c', title: 'c', due: '2026-11-09', done: false }] };
    expect(lateDeliverables([p], '2026-11-03').map((x) => x.d.id)).toEqual(['a']);
  });
});
