// agentClient.ts
//
// The ONLY module that should talk to the raw CXone Agent SDK.
// Everything else in the app imports from here. This isolation means that when
// you wire in the real SDK, you change this one file and nothing else breaks.
//
// Right now it runs in MOCK_MODE: it pretends to be the CXone platform so you
// can build and demo the UI before you have tenant credentials.
//
// ---------------------------------------------------------------------------
// HOW TO GO LIVE (later, once you have the real SDK + credentials):
//   1. Set MOCK_MODE = false.
//   2. Import the real CXone Agent SDK at the top.
//   3. Replace the body of each method below with the real SDK call.
//   4. In connect(), subscribe to the SDK's real-time events and forward them
//      to the emit* helpers, exactly as the mock simulation does.
// ---------------------------------------------------------------------------

import type { AgentStateName, Contact, ContactChannel } from './types';

/** Flip to false when the real CXone Agent SDK is wired in. */
export const MOCK_MODE = true;

// --- Event subscription plumbing -------------------------------------------
// The SDK pushes events at us (state changed, contact arrived). The UI wants to
// react. We expose on*() functions that register listeners and return an
// unsubscribe function. The store wires itself to these in ConsolePage.

type StateListener = (state: AgentStateName) => void;
type ContactListener = (contact: Contact) => void;

const stateListeners = new Set<StateListener>();
const contactOfferedListeners = new Set<ContactListener>();
const contactUpdatedListeners = new Set<ContactListener>();

function emitStateChange(state: AgentStateName) {
  stateListeners.forEach((cb) => cb(state));
}
function emitContactOffered(contact: Contact) {
  contactOfferedListeners.forEach((cb) => cb(contact));
}
function emitContactUpdated(contact: Contact) {
  contactUpdatedListeners.forEach((cb) => cb(contact));
}

export function onStateChange(cb: StateListener): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}
export function onContactOffered(cb: ContactListener): () => void {
  contactOfferedListeners.add(cb);
  return () => contactOfferedListeners.delete(cb);
}
export function onContactUpdated(cb: ContactListener): () => void {
  contactUpdatedListeners.add(cb);
  return () => contactUpdatedListeners.delete(cb);
}

// --- Internal mock state ----------------------------------------------------

let mockContactCounter = 0;
const activeContacts = new Map<string, Contact>();

function nowMs(): number {
  return new Date().getTime();
}

// --- Public API the rest of the app uses ------------------------------------

/**
 * Connect / log the agent in.
 * REAL SDK: initialize the SDK session with the access token, then subscribe
 * to its real-time events and forward them to the emit* helpers above.
 */
export async function connect(token: string): Promise<void> {
  if (MOCK_MODE) {
    console.info('[agentClient] MOCK connect with token:', token.slice(0, 8) + '...');
    // Simulate the platform putting the agent in Unavailable after login.
    emitStateChange('Unavailable');
    return;
  }
  // REAL: e.g. await cxoneSdk.init({ accessToken: token }); subscribe to events.
  throw new Error('Real SDK not wired in yet. Set MOCK_MODE = false and implement.');
}

/**
 * Change the agent's availability state.
 * REAL SDK: call the SDK's setAgentState / setStatus method.
 */
export async function setState(state: AgentStateName, reasonCode?: string): Promise<void> {
  if (MOCK_MODE) {
    console.info('[agentClient] MOCK setState:', state, reasonCode ?? '');
    emitStateChange(state);
    return;
  }
  throw new Error('Real SDK not wired in yet.');
}

/**
 * DEMO ONLY: simulate an inbound contact being offered to the agent.
 * Remove this when the real SDK is wired in. The real platform pushes contacts
 * to you via events; you never create them yourself.
 */
export function simulateIncomingContact(channel: ContactChannel = 'voice'): void {
  if (!MOCK_MODE) return;
  mockContactCounter += 1;
  const sampleCustomers = [
    { name: 'Marie Dubois', detail: '+33 6 12 34 56 78', skill: 'Support FR' },
    { name: 'James Carter', detail: 'james.carter@example.com', skill: 'Billing EN' },
    { name: 'Sofia Rossi', detail: 'Order #48213', skill: 'Sales IT' },
  ];
  const pick = sampleCustomers[mockContactCounter % sampleCustomers.length];
  const contact: Contact = {
    id: `mock-${mockContactCounter}`,
    channel,
    status: 'offered',
    customerName: pick.name,
    customerDetail: pick.detail,
    skill: pick.skill,
    startedAt: nowMs(),
  };
  activeContacts.set(contact.id, contact);
  emitContactOffered(contact);
}

/** Accept an offered contact. REAL SDK: call the accept method. */
export async function acceptContact(id: string): Promise<void> {
  const c = activeContacts.get(id);
  if (!c) return;
  c.status = 'active';
  emitContactUpdated({ ...c });
  emitStateChange('OnContact');
}

/** Reject / decline an offered contact. */
export async function rejectContact(id: string): Promise<void> {
  endContact(id);
}

/** Put an active contact on hold. */
export async function hold(id: string): Promise<void> {
  const c = activeContacts.get(id);
  if (!c) return;
  c.status = 'hold';
  emitContactUpdated({ ...c });
}

/** Resume a held contact. */
export async function unhold(id: string): Promise<void> {
  const c = activeContacts.get(id);
  if (!c) return;
  c.status = 'active';
  emitContactUpdated({ ...c });
}

/** Toggle mute on a voice contact. */
export async function toggleMute(id: string): Promise<void> {
  const c = activeContacts.get(id);
  if (!c) return;
  c.muted = !c.muted;
  emitContactUpdated({ ...c });
}

/** End / disconnect a contact. */
export async function endContact(id: string): Promise<void> {
  const c = activeContacts.get(id);
  if (!c) return;
  c.status = 'ended';
  emitContactUpdated({ ...c });
  activeContacts.delete(id);
  // After wrap-up the platform usually returns the agent to Available.
  emitStateChange('Available');
}
