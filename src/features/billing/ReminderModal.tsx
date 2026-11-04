import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import type { Invoice, Lead } from '../../api/schemas';
import { useBoot } from '../../app/boot';
import { useActions } from '../../app/actions';
import { Modal, useToast } from '../../components/overlay';
import { Field, Select } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { refreshAfterWrite } from '../../api/queries';
import { fDateY } from '../../lib/format';
import { daysOverdue, fillReminder, REMINDERS, suggestReminder } from './flow';
import { money, waLink } from './render';

/** Payment reminder: pick a tone, see the Arabic message as the client gets it, send on WhatsApp or by email. */
export function ReminderModal({ inv, lead, onClose }: { inv: Invoice; lead: Lead; onClose: () => void }) {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const qc = useQueryClient();
  const toast = useToast();
  const { fail } = useActions();
  const days = daysOverdue(inv.dueDate, Date.now());
  const [channel, setChannel] = useState<'wa' | 'email'>('wa');
  const [tpl, setTpl] = useState(() => suggestReminder(days, 'wa'));
  const r = REMINDERS.find((x) => x.id === tpl)!;
  const filled = useMemo(() => fillReminder(r, {
    name: inv.data.client?.contact || lead.name, business: lead.business || lead.name, invoice: inv.id, amount: money(inv.balance ?? inv.amount, inv.currency),
    due: fDateY(inv.dueDate, lang), days, link: inv.link, sender: boot.me.name
  }), [r, inv, lead, lang, days, boot.me.name]);
  const [body, setBody] = useState(filled.body);
  const [edited, setEdited] = useState(false);
  const text = edited ? body : filled.body;
  const [busy, setBusy] = useState(false);
  const pick = (id: string) => { setTpl(id); setEdited(false); };
  const switchChannel = (c: 'wa' | 'email') => { setChannel(c); pick(suggestReminder(days, c)); };
  async function send() {
    const win = channel === 'wa' ? window.open('about:blank', '_blank') : null;
    setBusy(true);
    try {
      const phone = inv.data.client?.phone || lead.phone;
      if (channel === 'wa') {
        if (win) win.location.href = waLink(phone, text);
        await api.logWhatsApp({ leadId: lead.id, text: 'تذكير بالفاتورة ' + inv.id + ': ' + text.slice(0, 200), template: tpl });
      } else {
        const to = inv.data.client?.email || lead.email;
        window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(filled.subject) + '&body=' + encodeURIComponent(text);
        await api.addActivity({ leadId: lead.id, kind: 'إيميل', direction: 'صادر', summary: 'تذكير بالفاتورة ' + inv.id, details: text });
      }
      refreshAfterWrite(qc, lead.id);
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast(t('اتسجل التذكير في الخط الزمني', 'Reminder logged on the timeline'));
      onClose();
    } catch (e) { win?.close(); fail(e); }
    setBusy(false);
  }
  return (
    <Modal open onClose={onClose} size="lg" title={t('تذكير بالدفع · ', 'Payment reminder · ') + inv.id}
      footer={<><button className="btn btn--primary" disabled={busy} onClick={send}><Icon name={channel === 'wa' ? 'wa' : 'mail'} />{channel === 'wa' ? t('افتح واتساب وسجّل', 'Open WhatsApp & log') : t('افتح الإيميل وسجّل', 'Open email & log')}</button><button className="btn btn--ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</button></>}>
      <div className="row wrap" style={{ gap: 10 }}>
        <div className="seg" role="group" aria-label={t('القناة', 'Channel')}>
          <button aria-pressed={channel === 'wa'} onClick={() => switchChannel('wa')}>{t('واتساب', 'WhatsApp')}</button>
          <button aria-pressed={channel === 'email'} onClick={() => switchChannel('email')}>{t('إيميل', 'Email')}</button>
        </div>
        <span className="tag tag--warn">{days > 0 ? t(`متأخرة ${days} يوم`, `${days} days late`) : t('لسه في ميعادها', 'Not due yet')}</span>
        <span className="tag">{money(inv.balance ?? inv.amount, inv.currency)}</span>
      </div>
      <Field label={t('القالب', 'Template')}><Select raw value={tpl} onValue={pick} options={REMINDERS.filter((x) => x.channel === channel).map((x) => [x.id, t(x.name[0], x.name[1])] as [string, string])} /></Field>
      {channel === 'email' ? <div className="g-mail"><div><b>{t('الموضوع: ', 'Subject: ')}</b>{filled.subject}</div><pre>{text}</pre></div> : <div className="g-bubble" dir="rtl">{text}</div>}
      <Field label={t('عدّل الرسالة قبل الإرسال', 'Edit before sending')} hint={t('الأسماء والمبالغ اتملت لوحدها.', 'Names and amounts are filled in for you.')}>
        <textarea className="textarea" rows={5} value={text} onChange={(e) => { setBody(e.target.value); setEdited(true); }} />
      </Field>
    </Modal>
  );
}
