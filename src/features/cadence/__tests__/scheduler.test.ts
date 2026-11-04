import { describe, expect, it } from 'vitest';
import { agenda, DEFAULT_CADENCES, isFinished, mark, nextOpen, replyStops, schedule, workday, type Cadence, type Enrollment } from '../scheduler';

const C: Cadence = { id: 'c', name: 'x', audience: 'lead', steps: [{ day: 0, channel: 'wa', title: 'a' }, { day: 1, channel: 'call', title: 'b' }, { day: 2, channel: 'email', title: 'c' }, { day: 9, channel: 'wa', title: 'd' }] };
const E = (p: Partial<Enrollment> = {}): Enrollment => ({ id: 'e', cadenceId: 'c', leadId: 'L', start: '2026-11-02', done: [], skipped: [], ...p }); // Monday

describe('cadence scheduler', () => {
  it('moves weekend days to Sunday', () => {
    expect(workday('2026-11-06')).toBe('2026-11-08'); // Fri → Sun
    expect(workday('2026-11-07')).toBe('2026-11-08'); // Sat → Sun
    expect(workday('2026-11-04')).toBe('2026-11-04');
  });
  it('schedules steps on working days, never two on the same day', () => {
    const s = schedule(E({ start: '2026-11-05' }), C, '2026-11-05'); // Thursday
    expect(s.map((x) => x.date)).toEqual(['2026-11-05', '2026-11-08', '2026-11-09', '2026-11-15']);
  });
  it('states: done, skipped, overdue, due, upcoming', () => {
    const s = schedule(E({ done: [0], skipped: [1] }), C, '2026-11-04');
    expect(s.map((x) => x.state)).toEqual(['done', 'skipped', 'due', 'upcoming']);
    expect(schedule(E(), C, '2026-11-04').map((x) => x.state).slice(0, 3)).toEqual(['overdue', 'overdue', 'due']);
  });
  it('next open step, finish and stop', () => {
    expect(nextOpen(E({ done: [0, 1] }), C, '2026-11-02')!.index).toBe(2);
    expect(isFinished(E({ done: [0, 1, 2], skipped: [3] }), C)).toBe(true);
    expect(nextOpen(E({ stopped: '2026-11-03' }), C, '2026-11-03')).toBeNull();
    expect(schedule(E({ stopped: '2026-11-03' }), C, '2026-11-03')[0].state).toBe('stopped');
  });
  it('mark moves a step between done and skipped', () => {
    const e = mark(mark(E(), 1, 'skipped'), 1, 'done');
    expect(e.done).toEqual([1]);
    expect(e.skipped).toEqual([]);
  });
  it('agenda lists due and overdue steps of live sequences only', () => {
    const list = agenda([E(), E({ id: 'e2', start: '2026-11-20' }), E({ id: 'e3', stopped: 'x' }), E({ id: 'e4', cadenceId: 'missing' })], [C], '2026-11-03');
    expect(list.map((x) => [x.enrollment.id, x.index, x.state])).toEqual([['e', 0, 'overdue']]);
  });
  it('a reply after the start stops the sequence', () => {
    expect(replyStops(E(), ['2026-11-01T10:00:00Z'])).toBe(false);
    expect(replyStops(E(), ['2026-11-03T10:00:00Z'])).toBe(true);
    expect(replyStops(E({ stopped: 'x' }), ['2026-11-03T10:00:00Z'])).toBe(false);
  });
  it('default cadences are well formed', () => {
    DEFAULT_CADENCES.forEach((c) => {
      expect(c.steps.length).toBeGreaterThan(2);
      expect(c.steps.map((s) => s.day)).toEqual([...c.steps.map((s) => s.day)].sort((a, b) => a - b));
    });
  });
});
