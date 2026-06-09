// outcomeStore.ts
//
// Holds the disposition and tag options available for the current contact
// (the SDK fetches these per contact and agentClient pushes them here), plus
// the set of contact ids whose outcome has already been saved, so we never
// ask the agent to disposition the same contact twice (a second save fails).

import { create } from 'zustand';
import type { DispositionOption, TagOption } from '../sdk/types';

interface OutcomeStore {
  dispositions: DispositionOption[];
  tags: TagOption[];
  savedContactIds: string[];

  setDispositions: (d: DispositionOption[]) => void;
  setTags: (t: TagOption[]) => void;
  markSaved: (contactId: string) => void;
  isSaved: (contactId: string) => boolean;
  clear: () => void;
}

export const useOutcomeStore = create<OutcomeStore>((set, get) => ({
  dispositions: [],
  tags: [],
  savedContactIds: [],

  setDispositions: (dispositions) => set({ dispositions }),
  setTags: (tags) => set({ tags }),
  markSaved: (contactId) =>
    set((s) =>
      s.savedContactIds.includes(contactId)
        ? s
        : { savedContactIds: [...s.savedContactIds, contactId] },
    ),
  isSaved: (contactId) => get().savedContactIds.includes(contactId),
  clear: () => set({ dispositions: [], tags: [], savedContactIds: [] }),
}));
