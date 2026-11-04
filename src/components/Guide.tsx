import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Icon } from './Icon';
import { store } from '../lib/storage';
import { config } from '../config';

/** «كيف يعمل؟»: how the system works, explained from inside it, with a short step tour. No video. */
const TOUR: { title: [string, string]; body: [string, string]; to: string }[] = [
  { to: '/', title: ['دفتر اليوم', 'Today’s desk'], body: ['هنا بتبدأ يومك: العلاقات اللي بتبرد، المتابعات المستحقة النهارده، الفلوس المتأخرة، واجتماعاتك. خلّص اللي فوق الأول.', 'Start here: cooling relationships, follow-ups due today, overdue money and your meetings. Clear the top first.'] },
  { to: '/clients', title: ['محفظة العملاء', 'Client portfolio'], body: ['كل عميل له صورة وحلقة بتوضح قوة العلاقة من 100. فوق: الاشتراكات الشهرية (MRR)، نسبة الخسارة، تقويم التجديدات وفرص البيع الإضافي.', 'Each client has a portrait with a ring showing relationship strength out of 100. Above: MRR, churn, the renewals calendar and upsell chances.'] },
  { to: '/clients', title: ['صفحة العميل 360°', 'Client 360°'], body: ['افتح أي عميل: خط زمني واحد لكل حاجة (مكالمات، واتساب، إيميلات، ملاحظات، عروض، دفعات)، خريطة الناس اللي عنده، وأزرار تسجيل مكالمة أو واتساب أو اجتماع بضغطة.', 'Open any client: one timeline for everything (calls, WhatsApp, emails, notes, quotes, payments), a map of their people, and one-tap log call / WhatsApp / meeting.'] },
  { to: '/billing', title: ['الفوترة والتحصيل', 'Billing & collections'], body: ['العرض ← العقد ← الفاتورة ← الدفع في لوحة واحدة. «أعمار الديون» بتوريك مين متأخر وبكام يوم، ومنها تبعت تذكير واتساب أو إيميل بقالب عربي جاهز.', 'Quote → contract → invoice → payment on one board. «Aging» shows who is late and by how many days; send a WhatsApp or email reminder from a ready Arabic template.'] },
  { to: '/sequences', title: ['المتابعات المتسلسلة', 'Follow-up sequences'], body: ['سجّل العميل في تسلسل (مثلًا «متابعة بعد العرض»): الخطوات بتتوزع على أيام الشغل، وتظهرلك يوم ميعادها. لو العميل رد، التسلسل بيقف لوحده.', 'Enrol a client in a sequence (e.g. «after the quote»): steps land on working days and show up when due. If the client replies, it stops by itself.'] }
];

export const guideKey = (email: string) => 'g3-guided:' + email.toLowerCase();
export const guideSeen = (email: string) => store.get(guideKey(email)) === '1';
export const markGuideSeen = (email: string) => store.set(guideKey(email), '1');

export function Guide({ open, onClose }: { open: false | 'about' | 'tour'; onClose: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const tourRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (open === 'tour') setTimeout(() => tourRef.current?.scrollIntoView({ block: 'start' }), 60);
  }, [open]);
  const s = TOUR[step];
  const keys: [string[], string][] = [
    [['Ctrl', 'K'], t('دوّر على أي عميل أو صفحة أو فاتورة', 'Find any client, page or invoice')],
    [['N'], t('عميل جديد', 'New client')],
    [['T'], t('مهمة جديدة', 'New task')],
    [['M'], t('رسالة للفريق', 'Message the team')],
    [['G'], t('افتح الدليل ده', 'Open this guide')]
  ];
  return (
    <Dialog.Root open={!!open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="g-guide" aria-describedby="g-guide-intro">
          <div className="g-guide__head">
            <Dialog.Title asChild><h2>{t('كيف يعمل؟', 'How it works')}</h2></Dialog.Title>
            <Dialog.Close className="ibtn ibtn--sm" aria-label={t('إغلاق', 'Close')}><Icon name="close" /></Dialog.Close>
          </div>
          <div className="g-guide__body">
            <section>
              <p id="g-guide-intro">{t('«علاقات» هو دفتر العملاء بتاع Magmafy: كل عميل له قصة واحدة من أول رسالة لحد آخر دفعة. ده مشوار أي عميل عندنا:', '«Relationships» is Magmafy’s client ledger: one story per client from the first message to the last payment. Every client walks this path:')}</p>
              <div className="g-path" style={{ marginTop: 10 }} aria-label={t('مشوار العميل', 'Client path')}>
                <span>{t('عميل محتمل', 'Lead')}</span><em>←</em><span>{t('متابعة', 'Follow-up')}</span><em>←</em><span>{t('صفقة', 'Deal')}</span><em>←</em><span>{t('عميل', 'Client')}</span><em>←</em><span>{t('فوترة', 'Billing')}</span>
              </div>
              <ul style={{ margin: '12px 0 0', paddingInlineStart: 18 }}>
                <li>{t('العميل المحتمل بيدخل من الموقع أو واتساب أو بإيدك (زرار «عميل جديد»).', 'A lead arrives from the site, WhatsApp or by hand («New client»).')}</li>
                <li>{t('المتابعة: كل مكالمة أو رسالة بتتسجل في الخط الزمني، والتسلسلات بتفكرك بالخطوة الجاية.', 'Follow-up: every call or message lands on the timeline; sequences remind you of the next step.')}</li>
                <li>{t('الصفقة: بتتحرك في «مسار الصفقات» لحد عرض السعر والتفاوض.', 'Deal: moves along the pipeline up to the quote and negotiation.')}</li>
                <li>{t('العميل: لما يوافق بيبقى «عميل نشط» وله صفحة 360° وقائمة تأهيل ومشاريع.', 'Client: on acceptance it becomes an active client with a 360° page, onboarding and projects.')}</li>
                <li>{t('الفوترة: العرض بيتحول لعقد ثم فواتير حسب خطة الدفع، والدفعات بتتسجل برقم التحويل.', 'Billing: the quote becomes a contract, then invoices by the payment plan; payments are recorded with the transfer ref.')}</li>
              </ul>
            </section>
            <section>
              <h3>{t('البيانات بتتحفظ فين؟', 'Where does the data live?')}</h3>
              <p>{t('كل العملاء والمهام والمواعيد والفواتير محفوظة في Google Sheet بتاع الشركة، وفيه Google Apps Script هو اللي بيكلم الموقع ده ويبعت الإيميلات والتنبيهات. الملاحظات وقوائم التأهيل والمشاريع والعقود والتسلسلات محفوظة على جهازك.', 'Clients, tasks, meetings and invoices live in the company Google Sheet; a Google Apps Script talks to this site and sends the emails and alerts. Notes, onboarding lists, projects, contracts and sequences are kept on this device.')}</p>
              {config.mock ? <p className="hint hint--warn" style={{ marginTop: 8 }}>{t('إنت دلوقتي في وضع التجربة: البيانات تجريبية ومحفوظة في المتصفح بس (mock)، ومفيش حاجة بتروح للشيت.', 'You are in demo mode: sample data kept in this browser only (mock); nothing reaches the sheet.')}</p> : null}
            </section>
            <section>
              <h3>{t('أهم 5 اختصارات', 'Top 5 shortcuts')}</h3>
              <dl className="g-keys">{keys.map(([k, l]) => <div key={l} style={{ display: 'contents' }}><dt>{k.map((x) => <kbd key={x}>{x}</kbd>)}</dt><dd>{l}</dd></div>)}</dl>
            </section>
            <section ref={tourRef} aria-labelledby="g-tour-t">
              <h3 id="g-tour-t">{t('جولة سريعة', 'Quick tour')}</h3>
              <div className="g-tourbox" aria-live="polite">
                <div className="g-tourbox__n" aria-hidden="true">{TOUR.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
                <small className="faint num">{step + 1} / {TOUR.length}</small>
                <b>{t(s.title[0], s.title[1])}</b>
                <p>{t(s.body[0], s.body[1])}</p>
                <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
                  {step > 0 ? <button className="btn btn--sm" onClick={() => setStep(step - 1)}>{t('السابق', 'Back')}</button> : null}
                  {step < TOUR.length - 1
                    ? <button className="btn btn--sm btn--primary" onClick={() => setStep(step + 1)}>{t('التالي', 'Next')}</button>
                    : <button className="btn btn--sm btn--primary" onClick={onClose}>{t('يلا نبدأ', 'Let’s go')}</button>}
                  <span className="grow" />
                  <button className="btn btn--sm btn--ghost" onClick={() => { onClose(); nav(s.to); }}>{t('وريني الصفحة', 'Show me')}<Icon name="arrow" /></button>
                </div>
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
