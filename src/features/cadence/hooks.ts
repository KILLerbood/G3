import { useEffect } from 'react';
import { useEnrollments, useRecentActivity } from '../clients/data';
import { DEFAULT_CADENCES, replyStops } from './scheduler';
import { todayKey } from '../../lib/time';

export const cadences = DEFAULT_CADENCES;
/** A client reply after a sequence started stops it (the conversation is live now). Runs wherever sequences are shown. */
export function useAutoStop() {
  const [enr, setEnr] = useEnrollments();
  const feed = useRecentActivity();
  useEffect(() => {
    const items = feed.data?.items;
    if (!items) return;
    const stop = enr.filter((e) => !e.stopped && replyStops(e, items.filter((a) => a.leadId === e.leadId && a.direction === 'وارد' && ['واتساب', 'إيميل', 'مكالمة'].includes(a.kind)).map((a) => a.date)));
    if (stop.length) setEnr((all) => all.map((e) => (stop.some((s) => s.id === e.id) ? { ...e, stopped: todayKey(), stopReason: 'reply' } : e)));
  }, [feed.data, enr, setEnr]);
  return enr;
}
