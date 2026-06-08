// agentStore.ts
//
// Global state for the agent: are we connected, who is the agent, and what is
// their current availability state. Components read from this store and
// re-render automatically when it changes.

import { create } from 'zustand';
import type { AgentStateName } from '../sdk/types';

interface AgentStore {
  connected: boolean;
  agentName: string;
  state: AgentStateName;

  setConnected: (value: boolean) => void;
  setAgentName: (name: string) => void;
  setState: (state: AgentStateName) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  connected: false,
  agentName: '',
  state: 'LoggedOut',

  setConnected: (value) => set({ connected: value }),
  setAgentName: (name) => set({ agentName: name }),
  setState: (state) => set({ state }),
  reset: () => set({ connected: false, agentName: '', state: 'LoggedOut' }),
}));
