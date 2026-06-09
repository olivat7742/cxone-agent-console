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

/** Where a contact is in its lifecycle. 'wrapup' = disconnected, awaiting disposition (ACW). */
export type ContactStatus = 'offered' | 'active' | 'hold' | 'wrapup' | 'ended';

/** A disposition option the agent can pick at wrap-up. */
export interface DispositionOption {
  id: number;
  name: string;
}

/** A tag option the agent can attach to the contact. */
export interface TagOption {
  id: number;
  name: string;
}

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
  /**
   * Whether the agent must manually accept this contact. When false, the
   * contact auto-answers (the platform connects it automatically) and the
   * Accept button must NOT be shown, calling accept would be a 409 conflict.
   */
  requiresAccept?: boolean;
  /** Whether dispositions are allowed for this contact (show the outcome panel). */
  allowDispositions?: boolean;
  /** Whether a disposition is required before wrap-up can complete. */
  requiresDisposition?: boolean;
}

