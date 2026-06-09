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
      const existing = s.contacts.find((c) => c.caseId === contact.caseId);
      // Digital contact events are often "bare" (no messages). Don't let an empty
      // messages array from such an event wipe a thread we already fetched.
      const incoming =
        existing && (!contact.messages || contact.messages.length === 0)
          ? { ...contact, messages: existing.messages }
          : contact;
      const contacts = existing
        ? s.contacts.map((c) => (c.caseId === contact.caseId ? { ...c, ...incoming } : c))
        : [...s.contacts, incoming];
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
