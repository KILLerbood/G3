/** Shared reads for the G3 relationship pages: all billing, recent activity, strength per client, local records. */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import type { Activity, Billing, Bootstrap } from '../../api/schemas';
import { useLocalState } from '../../lib/localState';
import { relationshipStrength, type Strength } from './strength';
import type { CheckItem, Project } from './onboarding';
import type { Contract } from '../billing/flow';
import type { Enrollment } from '../cadence/scheduler';

export const billingAllKey = ['billing', 'all'] as const;
export const useAllBilling = () => useQuery({ queryKey: billingAllKey, queryFn: () => api.billing({}), staleTime: 30_000 });
export const useRecentActivity = () => useQuery({ queryKey: ['feed', 'g3-recent'], queryFn: () => api.activityFeed({ limit: 200 }), staleTime: 60_000 });

export function useStrengths(boot: Bootstrap, billing: Billing | undefined, acts: Activity[] | undefined): Record<string, Strength> {
  return useMemo(() => {
    const now = Date.now();
    const out: Record<string, Strength> = {};
    const byLead = new Map<string, Activity[]>();
    (acts || []).forEach((a) => byLead.set(a.leadId, [...(byLead.get(a.leadId) || []), a]));
    boot.leads.forEach((l) => {
      out[l.id] = relationshipStrength({
        now, stage: l.stage, lastContact: l.lastContact,
        activities: byLead.get(l.id) || [],
        bookings: boot.bookings.filter((b) => b.leadId === l.id),
        invoices: (billing?.invoices || []).filter((i) => i.leadId === l.id)
      });
    });
    return out;
  }, [boot, billing, acts]);
}

export type Note = { id: string; leadId: string; at: string; by: string; text: string; mentions: string[] };
export type AccountContact = { id: string; leadId: string; name: string; title: string; role: 'decider' | 'champion' | 'user' | 'blocker' | 'finance'; phone: string; email: string };

export const useNotes = () => useLocalState<Note[]>('g3-notes', []);
export const useChecklists = () => useLocalState<Record<string, CheckItem[]>>('g3-onboarding', {});
export const useProjects = () => useLocalState<Project[]>('g3-projects', []);
export const useContracts = () => useLocalState<Contract[]>('g3-contracts', []);
export const useEnrollments = () => useLocalState<Enrollment[]>('g3-cadence-enrollments', []);
export const useAccountContacts = () => useLocalState<AccountContact[]>('g3-account-contacts', []);
export const ROLE_LABEL: Record<AccountContact['role'], [string, string]> = {
  decider: ['صاحب القرار', 'Decision maker'], champion: ['بيدعمنا', 'Champion'], user: ['مستخدم', 'User'], blocker: ['معترض', 'Blocker'], finance: ['الحسابات', 'Finance']
};
