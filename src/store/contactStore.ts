// contactStore.ts
//
// Global state for contacts (calls, chats, emails). The SDK event handlers
// push contacts in here; the UI renders whatever is in this list.

import { create } from 'zustand';
import type { Contact } from '../sdk/types';

interface ContactStore {
  contacts: Contact[];

  /** Add a new contact or replace an existing one with the same id. */
  upsertContact: (contact: Contact) => void;
  /** Remove a contact (e.g. after it ends). */
  removeContact: (id: string) => void;
  clear: () => void;
}

export const useContactStore = create<ContactStore>((set) => ({
  contacts: [],

  upsertContact: (contact) =>
    set((s) => {
      const exists = s.contacts.some((c) => c.id === contact.id);
      const contacts = exists
        ? s.contacts.map((c) => (c.id === contact.id ? contact : c))
        : [...s.contacts, contact];
      return { contacts };
    }),

  removeContact: (id) =>
    set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),

  clear: () => set({ contacts: [] }),
}));
