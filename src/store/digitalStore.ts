// digitalStore.ts
//
// State for digital (messaging) contacts and their message threads. The
// agentClient pushes contacts and messages here from the digital SDK events.

import { create } from 'zustand';
import type { DigitalContactView, DigitalMessage } from '../sdk/types';

interface DigitalStore {
  contacts: DigitalContactView[];
  selectedCaseId: string | null;

  upsertContact: (contact: DigitalContactView) => void;
  setMessages: (caseId: string, messages: DigitalMessage[]) => void;
  select: (caseId: string | null) => void;
  removeContact: (caseId: string) => void;
  clear: () => void;
}

export const useDigitalStore = create<DigitalStore>((set) => ({
  contacts: [],
  selectedCaseId: null,

  upsertContact: (contact) =>
    set((s) => {
      const exists = s.contacts.some((c) => c.caseId === contact.caseId);
      const contacts = exists
        ? s.contacts.map((c) => (c.caseId === contact.caseId ? { ...c, ...contact } : c))
        : [...s.contacts, contact];
      // Auto-select the first contact if none selected.
      const selectedCaseId = s.selectedCaseId ?? contact.caseId;
      return { contacts, selectedCaseId };
    }),

  setMessages: (caseId, messages) =>
    set((s) => ({
      contacts: s.contacts.map((c) => (c.caseId === caseId ? { ...c, messages } : c)),
    })),

  select: (caseId) => set({ selectedCaseId: caseId }),

  removeContact: (caseId) =>
    set((s) => {
      const contacts = s.contacts.filter((c) => c.caseId !== caseId);
      const selectedCaseId =
        s.selectedCaseId === caseId ? (contacts[0]?.caseId ?? null) : s.selectedCaseId;
      return { contacts, selectedCaseId };
    }),

  clear: () => set({ contacts: [], selectedCaseId: null }),
}));
