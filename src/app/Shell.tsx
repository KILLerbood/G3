import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useBootstrap, usePulse } from '../api/queries';
import { BootCtx } from './boot';
import { ActionsProvider, useActions } from './actions';
import { useI18n } from '../i18n';
import { useTheme } from './theme';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { Avatar, IconButton, Skel } from '../components/ui';
import { Modal } from '../components/overlay';
import { NotificationsBell } from '../components/NotificationsPanel';
import { CommandPalette } from '../components/CommandPalette';
import { Shortcuts } from '../components/Tour';
import { Guide, guideSeen, markGuideSeen } from '../components/Guide';
import { AnnouncementBanner, UrgentModal } from '../components/Announcements';
import { errorText } from '../api/errors';
import { LostReasonProvider } from '../features/lead/mutations';
import { isLate } from '../lib/rules';
import { useOnline } from '../lib/hooks';
import type { Bootstrap } from '../api/schemas';
import { api } from '../api/endpoints';
import { refreshDevice } from '../lib/push';

const LeadDrawer = lazy(() => import('../features/lead/LeadView').then((m) => ({ default: m.LeadDrawer })));

export function Shell() {
  const { t, lang } = useI18n();
  const boot = useBootstrap();
  if (boot.isLoading || (!boot.data && !boot.isError)) return <BootSkeleton />;
  if (!boot.data) {
    return (
      <div className="g-login" style={{ gridTemplateColumns: '1fr' }}>
        <div className="g-login__form">
          <div className="auth__box">
            <h1 className="display">{t('الـ CRM مافتحش', 'The CRM didn’t load')}</h1>
            <p>{errorText(boot.error, lang)}</p>
            <button className="btn btn--primary" onClick={() => boot.refetch()}>{t('حمّل تاني', 'Reload')}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <BootCtx.Provider value={boot.data}>
      <LostReasonProvider reasons={boot.data.lists['سبب الخسارة'] || []}>
        <ActionsProvider>
          <ShellFrame boot={boot.data} refreshing={boot.isFetching} onRefresh={() => boot.refetch()} />
        </ActionsProvider>
      </LostReasonProvider>
    </BootCtx.Provider>
  );
}

type NavItem = { to: string; icon: string; label: string; n?: number; bad?: boolean };

function ShellFrame({ boot, refreshing, onRefresh }: { boot: Bootstrap; refreshing: boolean; onRefresh: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, pref, setPref } = useTheme();
  const { signOut, authed } = useAuth();
  const actions = useActions();
  const nav = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const pulse = usePulse(authed);
  const online = useOnline();
  const [update, setUpdate] = useState(false);
  const pushKey = boot.settings.pushKey;
  useEffect(() => { if (pushKey) void refreshDevice(api, pushKey); }, [pushKey]);
  useEffect(() => { const on = () => setUpdate(true); window.addEventListener('mg-update', on); return () => window.removeEventListener('mg-update', on); }, []);
  const [cmdk, setCmdk] = useState(false);
  const [guide, setGuide] = useState<false | 'about' | 'tour'>(false);
  const [keys, setKeys] = useState(false);
  const [more, setMore] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const me = boot.me;
  const lateTasks = boot.tasks.filter(isLate).length;
  const unreadMsgs = pulse.data?.unread.messages ?? boot.inbox?.unread ?? 0;
  const unreadAnns = pulse.data?.unread.announcements ?? boot.announcements.filter((a) => !a.seenAt).length;
  const unreadNotifs = pulse.data?.unread.notifications ?? 0;
  const leadId = params.get('lead');
  const clients = boot.leads.filter((l) => l.stage === 'عميل نشط').length;

  // First run: the guide opens on its short tour, once per person per device, when no other dialog is open.
  const myEmail = boot.me.email;
  useEffect(() => {
    if (guideSeen(myEmail)) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries++;
      if (!document.querySelector('[role="dialog"]')) { window.clearInterval(id); setGuide('tour'); markGuideSeen(myEmail); }
      else if (tries > 20) window.clearInterval(id);
    }, 1500);
    return () => window.clearInterval(id);
  }, [myEmail]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 6);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); setMore(false); }, [loc.pathname]);
  // Keyboard: Ctrl/⌘+K or «/» search, N new client, T task, M message, ? shortcuts, G guide.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdk(true); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') { e.preventDefault(); setCmdk(true); }
      else if (e.key === 'n' || e.key === 'ى') { e.preventDefault(); actions.newLead(); }
      else if (e.key === 't' || e.key === 'ف') { e.preventDefault(); actions.newTask(); }
      else if (e.key === 'm' || e.key === 'ة') { e.preventDefault(); actions.newThread(); }
      else if (e.key === 'g' || e.key === 'ل') { e.preventDefault(); setGuide('about'); }
      else if (e.key === '?' || e.key === '؟') { e.preventDefault(); setKeys(true); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [actions]);

  const SECTIONS: [string, NavItem[]][] = [
    [t('العلاقات', 'Relationships'), [
      { to: '/', icon: 'home', label: t('دفتر اليوم', 'Today’s desk') },
      { to: '/clients', icon: 'users', label: t('محفظة العملاء', 'Client portfolio'), n: clients },
      { to: '/contacts', icon: 'contacts', label: t('جهات الاتصال', 'Contacts') },
      { to: '/companies', icon: 'building', label: t('الشركات', 'Companies') }
    ]],
    [t('البيع والمتابعة', 'Selling'), [
      { to: '/sales-tools/pipeline', icon: 'board', label: t('مسار الصفقات', 'Pipeline') },
      { to: '/sequences', icon: 'refresh', label: t('المتابعات المتسلسلة', 'Sequences') },
      { to: '/tasks', icon: 'tasks', label: t('المهام', 'Tasks'), n: lateTasks, bad: true },
      { to: '/schedule', icon: 'calendar', label: t('المواعيد', 'Schedule') }
    ]],
    [t('الفلوس', 'Money'), [
      { to: '/billing', icon: 'doc', label: t('الفوترة والتحصيل', 'Billing & collections') },
      { to: '/sales-tools/reports', icon: 'chart', label: t('التقارير', 'Reports') }
    ]],
    [t('الفريق', 'Team'), [
      { to: '/inbox', icon: 'inbox', label: t('المحادثات', 'Inbox'), n: unreadMsgs },
      { to: '/announcements', icon: 'megaphone', label: t('الإعلانات', 'Announcements'), n: unreadAnns },
      { to: '/sales-tools', icon: 'tools', label: t('أدوات البيع', 'Sales tools') },
      { to: '/settings', icon: 'settings', label: t('الإعدادات', 'Settings') }
    ]]
  ];
  const active = (p: string) => (p === '/' ? loc.pathname === '/' : p === '/sales-tools' ? loc.pathname === '/sales-tools' || loc.pathname === '/sales-tools/templates' || loc.pathname === '/sales-tools/activity' : loc.pathname.startsWith(p));
  const all = SECTIONS.flatMap(([, items]) => items);

  const accountMenu = (trigger: React.ReactNode) => (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="end" sideOffset={8}>
          <div style={{ padding: '10px 12px 8px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Avatar name={me.name} size="sm" />
            <div style={{ minWidth: 0 }}><b style={{ display: 'block', fontWeight: 600 }}>{me.name}</b><small className="faint ltr">{me.email}</small></div>
          </div>
          <Menu.Separator className="menu__sep" />
          <Menu.Item className="menu__item" onSelect={() => nav('/profile')}><Icon name="user" />{t('حسابي', 'Profile')}</Menu.Item>
          <Menu.Item className="menu__item" onSelect={() => nav('/settings')}><Icon name="settings" />{t('الإعدادات', 'Settings')}</Menu.Item>
          <Menu.Item className="menu__item" onSelect={() => setGuide('tour')}><Icon name="sparkle" />{t('جولة سريعة', 'Quick tour')}</Menu.Item>
          <Menu.Item className="menu__item" onSelect={() => setKeys(true)}><Icon name="edit" />{t('اختصارات الكيبورد', 'Keyboard shortcuts')}<kbd style={{ marginInlineStart: 'auto' }}>?</kbd></Menu.Item>
          <Menu.Item className="menu__item" onSelect={onRefresh}><Icon name="refresh" />{refreshing ? t('بيتحدّث…', 'Refreshing…') : t('تحديث البيانات', 'Refresh data')}</Menu.Item>
          <Menu.Separator className="menu__sep" />
          <div className="menu__label">{t('المظهر', 'Appearance')}</div>
          {([['light', 'sun', t('فاتح (ورقي)', 'Light (paper)')], ['dark', 'moon', t('غامق', 'Dark')], ['auto', 'monitor', t('حسب الجهاز', 'System')]] as const).map(([k, ic, l]) => (
            <Menu.Item key={k} className="menu__item" onSelect={() => setPref(k)}><Icon name={ic} />{l}{pref === k ? <Icon name="check" className="faint" /> : null}</Menu.Item>
          ))}
          <Menu.Item className="menu__item" onSelect={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" />{lang === 'ar' ? 'English' : 'العربية'}</Menu.Item>
          {boot.settings.sheetUrl ? <Menu.Item className="menu__item" onSelect={() => window.open(boot.settings.sheetUrl, '_blank', 'noopener')}><Icon name="template" />{t('افتح الشيت', 'Open the sheet')}</Menu.Item> : null}
          <Menu.Separator className="menu__sep" />
          <Menu.Item className="menu__item" onSelect={() => signOut()}><Icon name="logout" />{t('خروج', 'Sign out')}</Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );

  return (
    <>
      <a href="#main" className="sr-only" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t('انتقل للمحتوى', 'Skip to content')}</a>
      <div className="g-app">
        <aside className="g-side" aria-label={t('القائمة الرئيسية', 'Main menu')}>
          <NavLink to="/" className="g-brand" aria-label="Magmafy · علاقات">
            <Logo size={38} />
            <span><b>Magmafy</b><small>{t('علاقات · دفتر العملاء', 'Relationships ledger')}</small></span>
          </NavLink>
          <button className="g-newbtn" onClick={actions.newLead}><Icon name="plus" />{t('عميل جديد', 'New client')}<kbd style={{ background: 'transparent', color: 'inherit', borderColor: 'rgba(255,255,255,.35)' }}>N</kbd></button>
          <nav aria-label={t('الصفحات', 'Pages')}>
            {SECTIONS.map(([title, items]) => (
              <div key={title}>
                <div className="g-side__sec">{title}</div>
                {items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.to === '/'} className="g-nav" aria-current={active(it.to) ? 'page' : undefined}>
                    <Icon name={it.icon} /><span>{it.label}</span>
                    {it.n ? <span className="g-nav__n" aria-label={'(' + it.n + ')'} style={it.bad ? { background: 'var(--bad)' } : undefined}>{it.n > 99 ? '99+' : it.n}</span> : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="g-side__foot">
            {accountMenu(
              <button className="g-me" aria-label={t('قايمة الحساب', 'Account menu')}>
                <Avatar name={me.name} size="sm" />
                <span style={{ minWidth: 0, flex: 1 }}><b className="ellipsis">{me.name}</b><small>{me.isAdmin ? t('أدمن', 'Admin') : me.role}</small></span>
                <Icon name="more" size={18} />
              </button>
            )}
          </div>
        </aside>

        <div className="g-main">
          <header className={'g-top' + (scrolled ? ' is-scrolled' : '')}>
            <NavLink to="/" className="g-mtop" aria-label="Magmafy · علاقات"><Logo size={34} /></NavLink>
            <button className="g-search" onClick={() => setCmdk(true)} aria-label={t('بحث (Ctrl+K)', 'Search (Ctrl+K)')}>
              <Icon name="search" /><span className="ellipsis">{t('دوّر على عميل، فاتورة، صفحة…', 'Find a client, invoice, page…')}</span><kbd>Ctrl K</kbd>
            </button>
            <span className="grow" />
            <div className="g-quick">
              <IconButton icon="tasks" label={t('مهمة جديدة (T)', 'New task (T)')} onClick={() => actions.newTask()} />
              <IconButton icon="calendar" label={t('احجز اجتماع', 'Book a meeting')} onClick={() => actions.book()} />
            </div>
            <NotificationsBell unread={unreadNotifs} />
            <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? t('الوضع الفاتح', 'Light mode') : t('الوضع الغامق', 'Dark mode')} onClick={() => setPref(theme === 'dark' ? 'light' : 'dark')} className="hide-sm" />
            <span className="show-sm">{accountMenu(<button className="ibtn" aria-label={t('قايمة الحساب', 'Account menu')} style={{ padding: 0, border: 0 }}><Avatar name={me.name} size="sm" /></button>)}</span>
          </header>

          <div className="g-banner">
            {!online ? <div className="banner banner--عاجل" role="alert"><span className="pulse-dot" />{t('مفيش نت دلوقتي. البيانات اللي قدامك للقراية بس لحد ما النت يرجع.', 'You’re offline. What you see is read-only until you’re back online.')}</div> : null}
            {update ? (
              <div className="banner" role="status"><Icon name="sparkle" size={16} /><span className="grow">{t('فيه نسخة جديدة من الموقع.', 'A new version is available.')}</span>
                <button className="btn btn--sm btn--primary" onClick={() => { navigator.serviceWorker?.getRegistration().then((r) => (r?.waiting ? r.waiting.postMessage('skip') : location.reload())); }}>{t('حدّث', 'Update')}</button></div>
            ) : null}
            <AnnouncementBanner boot={boot} />
          </div>

          <main className="g-page" id="main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="g-bnav" aria-label={t('التنقل', 'Navigation')}>
        {([['/', 'home', t('اليوم', 'Today')], ['/clients', 'users', t('العملاء', 'Clients')], ['/billing', 'doc', t('الفوترة', 'Billing')], ['/tasks', 'tasks', t('المهام', 'Tasks')]] as const).map(([p, ic, l]) => (
          <NavLink key={p} to={p} end={p === '/'} aria-current={active(p) ? 'page' : undefined}>
            <Icon name={ic} />{l}
            {p === '/tasks' && lateTasks ? <span className="cnt cnt--bad" aria-label={'(' + lateTasks + ')'}>{lateTasks > 9 ? '9+' : lateTasks}</span> : null}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)} aria-haspopup="dialog" aria-current={!['/', '/clients', '/billing', '/tasks'].some((p) => active(p)) ? 'page' : undefined}>
          <Icon name="more" />{t('المزيد', 'More')}
          {unreadMsgs ? <span className="cnt" aria-label={'(' + unreadMsgs + ')'}>{unreadMsgs > 9 ? '9+' : unreadMsgs}</span> : null}
        </button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title={t('كل الصفحات', 'All pages')}>
        <div className="g-sheet">
          <button onClick={() => { setMore(false); actions.newLead(); }}><Icon name="userplus" />{t('عميل جديد', 'New client')}</button>
          {all.filter((i) => !['/', '/clients', '/billing', '/tasks'].includes(i.to)).map((i) => (
            <NavLink key={i.to} to={i.to} onClick={() => setMore(false)}><Icon name={i.icon} />{i.label}{i.n ? ' (' + i.n + ')' : ''}</NavLink>
          ))}
          <NavLink to="/profile" onClick={() => setMore(false)}><Icon name="user" />{t('حسابي', 'Profile')}</NavLink>
        </div>
      </Modal>

      <button className="g-help" onClick={() => setGuide('about')} aria-haspopup="dialog"><i aria-hidden="true">?</i>{t('كيف يعمل؟', 'How it works')}</button>
      <Guide open={guide} onClose={() => setGuide(false)} />

      <Suspense fallback={null}>{leadId ? <LeadDrawer id={leadId} onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('lead'); n.delete('ltab'); return n; })} /> : null}</Suspense>
      <CommandPalette boot={boot} open={cmdk} onOpenChange={setCmdk} onAction={(a) => (a === 'lead' ? actions.newLead() : a === 'task' ? actions.newTask() : a === 'message' ? actions.newThread() : a === 'tour' ? setGuide('tour') : a === 'keys' ? setKeys(true) : actions.editAnnouncement())} />
      <Shortcuts open={keys} onClose={() => setKeys(false)} />
      <UrgentModal pulse={pulse.data} boot={boot} />
    </>
  );
}

function BootSkeleton() {
  return (
    <div className="g-app" aria-busy="true">
      <aside className="g-side">{[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skel" style={{ height: 34, opacity: .25, margin: '6px 4px' }} />)}</aside>
      <div className="g-main">
        <header className="g-top"><Skel h={42} w="40%" r={10} /></header>
        <main className="g-page">
          <div className="stack" style={{ gap: 18 }}>
            <Skel h={54} w="42%" r={12} />
            <Skel h={96} r={16} />
            <div className="g-cols"><Skel h={320} r={16} /><Skel h={320} r={16} /></div>
          </div>
        </main>
      </div>
    </div>
  );
}
