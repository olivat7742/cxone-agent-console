// types.ts
//
// Shared types used across the app. Keeping them in one place means the SDK
// wrapper, the stores, and the UI all agree on the shape of the data.
//
// These names are our own abstraction. When you read the real CXone Agent SDK
// docs, you may rename or extend these to match the platform's vocabulary.

/** The agent's current availability state. */
export type AgentStateName =
  | 'LoggedOut'
  | 'Available'
  | 'Unavailable'
  | 'Working'
  | 'OnContact';

/** The communication channel a contact arrives on. */
export type ContactChannel = 'voice' | 'chat' | 'email' | 'work_item';

/** Where a contact is in its lifecycle. */
export type ContactStatus = 'offered' | 'active' | 'hold' | 'ended';

/** A single customer interaction (call, chat, email, etc.). */
export interface Contact {
  id: string;
  channel: ContactChannel;
  status: ContactStatus;
  customerName: string;
  customerDetail?: string;
  skill?: string;
  /** Epoch ms when the contact was offered. */
  startedAt: number;
  /** True when the agent has muted their mic (voice only). */
  muted?: boolean;
}

/** Reason codes shown when an agent goes Unavailable. */
export const UNAVAILABLE_REASONS = [
  'Break',
  'Lunch',
  'Meeting',
  'Training',
  'Admin Work',
] as const;
