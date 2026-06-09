// outcomeStore.ts
//
// Holds the disposition and tag options available for the current contact.
// The SDK fetches these per contact and the agentClient pushes them here.

import { create } from 'zustand';
import type { DispositionOption, TagOption } from '../sdk/types';

interface OutcomeStore {
  dispositions: DispositionOption[];
  tags: TagOption[];

  setDispositions: (d: DispositionOption[]) => void;
  setTags: (t: TagOption[]) => void;
  clear: () => void;
}

export const useOutcomeStore = create<OutcomeStore>((set) => ({
  dispositions: [],
  tags: [],

  setDispositions: (dispositions) => set({ dispositions }),
  setTags: (tags) => set({ tags }),
  clear: () => set({ dispositions: [], tags: [] }),
}));
