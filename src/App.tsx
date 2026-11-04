import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { Login } from './auth/Login';
import { Shell } from './app/Shell';
import { Skel } from './components/ui';
import { NotFound } from './app/NotFound';
import { ErrorBoundary } from './app/ErrorBoundary';

const page = <T,>(f: () => Promise<T>, name: keyof T) => lazy(() => f().then((m) => ({ default: m[name] as unknown as () => JSX.Element })));
const Workspace = page(() => import('./features/clients/Desk'), 'Desk');
const Portfolio = page(() => import('./features/portfolio/Portfolio'), 'Portfolio');
const Client360 = page(() => import('./features/clients/Client360'), 'Client360');
const BillingHub = page(() => import('./features/billing/BillingHub'), 'BillingHub');
const Sequences = page(() => import('./features/cadence/Sequences'), 'Sequences');
const Schedule = page(() => import('./features/schedule/Schedule'), 'Schedule');
const Contacts = page(() => import('./features/contacts/Contacts'), 'Contacts');
const Companies = page(() => import('./features/companies/Companies'), 'Companies');
const Company = page(() => import('./features/companies/Companies'), 'Company');
const LeadPage = page(() => import('./features/lead/LeadView'), 'LeadPage');
const Tasks = page(() => import('./features/tasks/Tasks'), 'Tasks');
const SalesTools = page(() => import('./features/sales/SalesTools'), 'SalesTools');
const Pipeline = page(() => import('./features/sales/Pipeline'), 'Pipeline');
const Reports = page(() => import('./features/sales/Reports'), 'Reports');
const Templates = page(() => import('./features/sales/Templates'), 'Templates');
const ActivityFeed = page(() => import('./features/sales/ActivityFeed'), 'ActivityFeed');
const Inbox = page(() => import('./features/inbox/Inbox'), 'Inbox');
const Announcements = page(() => import('./features/announcements/Announcements'), 'Announcements');
const Settings = page(() => import('./features/settings/Settings'), 'Settings');
const Profile = page(() => import('./features/profile/Profile'), 'Profile');
const More = page(() => import('./features/profile/Profile'), 'More');
const DocPage = page(() => import('./features/billing/DocPage'), 'DocPage');

function Protected() {
  const { authed, lostSession } = useAuth();
  const loc = useLocation();
  if (authed) return <Shell />;
  if (lostSession) return <><Shell /><Login overlay /></>;
  const next = loc.pathname + loc.search;
  return <Navigate to={'/login' + (next && next !== '/' ? '?next=' + encodeURIComponent(next) : '')} replace />;
}
function PublicOnly({ children }: { children: ReactNode }) {
  const { authed } = useAuth();
  return authed ? <Navigate to="/" replace /> : <>{children}</>;
}
const Wait = () => <div className="stack" style={{ gap: 20, paddingTop: 10 }}><Skel h={60} w="40%" r={20} /><Skel h={220} /><Skel h={220} /></div>;
const P = ({ children }: { children: ReactNode }) => <ErrorBoundary><Suspense fallback={<Wait />}><div className="page-enter">{children}</div></Suspense></ErrorBoundary>;

export function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      {/* A client's quote / invoice: open to anyone with the private link. */}
      <Route path="/d/:token" element={<ErrorBoundary><Suspense fallback={<div className="docpage"><div className="docpage__msg">…</div></div>}><DocPage /></Suspense></ErrorBoundary>} />
      <Route element={<Protected />}>
        <Route index element={<P><Workspace /></P>} />
        <Route path="clients" element={<P><Portfolio /></P>} />
        <Route path="clients/:id" element={<P><Client360 /></P>} />
        <Route path="billing" element={<P><BillingHub /></P>} />
        <Route path="sequences" element={<P><Sequences /></P>} />
        <Route path="schedule" element={<P><Schedule /></P>} />
        <Route path="contacts" element={<P><Contacts /></P>} />
        <Route path="companies" element={<P><Companies /></P>} />
        <Route path="companies/:key" element={<P><Company /></P>} />
        <Route path="leads/:id" element={<P><LeadPage /></P>} />
        <Route path="tasks" element={<P><Tasks /></P>} />
        <Route path="sales-tools" element={<P><SalesTools /></P>} />
        <Route path="sales-tools/pipeline" element={<P><Pipeline /></P>} />
        <Route path="sales-tools/reports" element={<P><Reports /></P>} />
        <Route path="sales-tools/templates" element={<P><Templates /></P>} />
        <Route path="sales-tools/activity" element={<P><ActivityFeed /></P>} />
        <Route path="inbox" element={<P><Inbox /></P>} />
        <Route path="inbox/:threadId" element={<P><Inbox /></P>} />
        <Route path="announcements" element={<P><Announcements /></P>} />
        <Route path="announcements/:annId" element={<P><Announcements /></P>} />
        <Route path="settings" element={<P><Settings /></P>} />
        <Route path="settings/:section" element={<P><Settings /></P>} />
        <Route path="profile" element={<P><Profile /></P>} />
        <Route path="more" element={<P><More /></P>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
