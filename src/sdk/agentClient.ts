// agentClient.ts
//
// The ONLY module that talks to the CXone SDK. Everything else imports from
// here. It drives the real SDK and writes results straight into the Zustand
// stores, so components just read state and re-render.
//
// Real SDK surface used (confirmed from the @nice-devone type definitions):
//   - CXoneAcdClient (acd-sdk): session, agent state, contacts
//   - CXoneVoiceClient (voice-sdk): WebRTC audio + agent leg
//   - CXoneClient (agent-sdk): agent settings / user details for WebRTC
//
// MOCK_MODE keeps the old simulator available for UI demos without a session.
// It is false now that the real integration is wired. The real paths cannot be
// fully verified until a client_id exists (login works) and a real contact
// routes to the agent, so treat the live behavior as "wired, pending live test".

import { CXoneAcdClient, CXoneVoiceContact } from '@nice-devone/acd-sdk';
import { CXoneVoiceClient } from '@nice-devone/voice-sdk';
import { CXoneClient } from '@nice-devone/agent-sdk';
import { AgentSessionStatus } from '@nice-devone/common-sdk';
import type { AgentState, AgentStateEvent, AgentSessionResponse } from '@nice-devone/common-sdk';
import { useAgentStore } from '../store/agentStore';
import { useContactStore } from '../store/contactStore';
import type { AgentStateName, Contact, ContactChannel, ContactStatus } from './types';

/** Set true to use the in-app simulator instead of the real SDK (UI demos). */
export const MOCK_MODE = false;

// --- Live contact instances (real mode) ------------------------------------
// We keep the live CXoneVoiceContact objects so action methods can call their
// own hold()/resume()/mute()/end() helpers.
const liveContacts = new Map<string, CXoneVoiceContact>();
let acdSubscribed = false;

// --- Mapping helpers --------------------------------------------------------

function mapContactStatus(raw: string | undefined): ContactStatus {
  const v = (raw ?? '').toLowerCase();
  if (v.includes('hold')) return 'hold';
  if (v.includes('disconnect') || v.includes('end') || v.includes('acw') || v.includes('complete')) {
    return 'ended';
  }
  if (v.includes('active') || v.includes('connect') || v.includes('progress') || v.includes('answer')) {
    return 'active';
  }
  return 'offered';
}

function mapVoiceContact(c: CXoneVoiceContact): Contact {
  return {
    id: c.contactID,
    channel: 'voice',
    status: mapContactStatus(c.status),
    customerName: c.customerName || c.ani || c.dnis || 'Unknown caller',
    customerDetail: c.ani || c.dnis || undefined,
    skill: c.skillName || c.skill || undefined,
    startedAt: c.startTime ? new Date(c.startTime).getTime() : new Date().getTime(),
    muted: c.agentMuted,
  };
}

function mapAgentState(event: AgentStateEvent): AgentStateName | null {
  const current = event?.currentState;
  const cxoneState = (current?.cxoneState ?? '').toLowerCase();
  if (cxoneState.includes('contact')) return 'OnContact';
  const state = (current?.state ?? '').toLowerCase();
  if (state.includes('unavailable')) return 'Unavailable';
  if (state.includes('available')) return 'Available';
  if (state.includes('working')) return 'Working';
  return null;
}

// --- ACD event subscriptions (real mode) ------------------------------------

function subscribeToAcdEvents(): void {
  if (acdSubscribed) return;
  acdSubscribed = true;

  const acd = CXoneAcdClient.instance;

  // Agent state changes -> agent store.
  acd.agentStateService.agentStateSubject.subscribe((event: AgentStateEvent) => {
    const name = mapAgentState(event);
    if (name) useAgentStore.getState().setState(name);
  });

  // Voice contact lifecycle -> contact store.
  acd.contactManager.voiceContactUpdateEvent.subscribe((c: CXoneVoiceContact) => {
    liveContacts.set(c.contactID, c);
    const mapped = mapVoiceContact(c);
    const store = useContactStore.getState();
    if (mapped.status === 'ended') {
      store.removeContact(mapped.id);
      liveContacts.delete(mapped.id);
    } else {
      store.upsertContact(mapped);
    }
  });

  // Session lifecycle -> start WebRTC when the session is up.
  acd.session.onAgentSessionChange.subscribe((res: AgentSessionResponse) => {
    if (
      res.status === AgentSessionStatus.JOIN_SESSION_SUCCESS ||
      res.status === AgentSessionStatus.SESSION_START
    ) {
      void initWebRTC();
    }
  });

  // Agent leg (voice path) -> hand off to the voice client.
  acd.session.agentLegEvent.subscribe((leg) => {
    CXoneVoiceClient.instance.handleAgentLegEvent(leg);
    const legAny = leg as unknown as { status?: string; agentLegId?: string };
    if (legAny.status === 'Dialing' && legAny.agentLegId) {
      CXoneVoiceClient.instance.connectAgentLeg(legAny.agentLegId);
    }
  });
}

// --- WebRTC bootstrap (real mode) -------------------------------------------
// Loosely typed on purpose: getAgentSettings()/getUserDetails() return unions
// with error types, and connectServer wants a connection-options object. This
// path needs a live session to verify; it is guarded so failures never crash.
let audioEl: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'cxone-remote-audio';
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);
  }
  return audioEl;
}

async function initWebRTC(): Promise<void> {
  try {
    const client = CXoneClient.instance as unknown as {
      agentSetting: { getAgentSettings: () => Promise<unknown> };
      cxoneUser: { getUserDetails: () => Promise<unknown> };
    };
    const agentSettings = await client.agentSetting.getAgentSettings();
    const userInfo = (await client.cxoneUser.getUserDetails()) as { icAgentId?: string };
    const acdAgentId = userInfo?.icAgentId;
    if (!acdAgentId || !agentSettings) return;
    CXoneVoiceClient.instance.connectServer(
      String(acdAgentId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agentSettings as any,
      getAudioElement(),
      'CXone Agent Console',
    );
  } catch (e) {
    console.warn('[agentClient] WebRTC connect failed (verify on live call):', e);
  }
}

// --- Public API -------------------------------------------------------------

/**
 * Start the ACD session after authentication. Called from auth/login after the
 * SDK auth modules are initialized. Safe to await; never throws.
 */
export async function initSession(): Promise<void> {
  if (MOCK_MODE) {
    useAgentStore.getState().setState('Unavailable');
    return;
  }
  try {
    await CXoneAcdClient.instance.initAcdEngagement();
    subscribeToAcdEvents();
    try {
      await CXoneAcdClient.instance.session.joinSession();
    } catch {
      // No existing session to join; start a new WebRTC voice session.
      await CXoneAcdClient.instance.session.startSession({
        stationId: '',
        stationPhoneNumber: 'WebRTC',
      });
    }
  } catch (e) {
    console.warn('[agentClient] initSession failed (verify after first login):', e);
  }
}

/** Change the agent's availability state. */
export async function setState(state: AgentStateName, reason?: string): Promise<void> {
  if (MOCK_MODE) {
    useAgentStore.getState().setState(state);
    return;
  }
  const payload: AgentState = { state, reason: reason ?? '' };
  try {
    await CXoneAcdClient.instance.agentStateService.setAgentState(payload);
  } catch (e) {
    console.warn('[agentClient] setState failed:', e);
  }
}

/** Accept an offered contact. */
export async function acceptContact(id: string): Promise<void> {
  if (MOCK_MODE) return mockTransition(id, 'active');
  try {
    await CXoneAcdClient.instance.contactManager.contactService.acceptContact(id);
  } catch (e) {
    console.warn('[agentClient] acceptContact failed:', e);
  }
}

/** Reject an offered contact. */
export async function rejectContact(id: string): Promise<void> {
  if (MOCK_MODE) return mockTransition(id, 'ended');
  try {
    await CXoneAcdClient.instance.contactManager.contactService.rejectContact(id);
  } catch (e) {
    console.warn('[agentClient] rejectContact failed:', e);
  }
}

/** Put an active contact on hold. */
export async function hold(id: string): Promise<void> {
  if (MOCK_MODE) return mockTransition(id, 'hold');
  await liveContacts.get(id)?.hold();
}

/** Resume a held contact. */
export async function unhold(id: string): Promise<void> {
  if (MOCK_MODE) return mockTransition(id, 'active');
  await liveContacts.get(id)?.resume();
}

/** Toggle mute on a voice contact. */
export async function toggleMute(id: string): Promise<void> {
  if (MOCK_MODE) return mockToggleMute(id);
  const c = liveContacts.get(id);
  if (!c) return;
  if (c.agentMuted) await c.unmute();
  else await c.mute();
}

/** End / disconnect a contact. */
export async function endContact(id: string): Promise<void> {
  if (MOCK_MODE) return mockTransition(id, 'ended');
  const c = liveContacts.get(id);
  if (c) await c.end();
  else await CXoneAcdClient.instance.contactManager.contactService.endContact(id);
}

// --- Mock simulator (MOCK_MODE only) ----------------------------------------

let mockCounter = 0;
const mockContacts = new Map<string, Contact>();

/** DEMO ONLY: simulate an inbound contact. No-op unless MOCK_MODE. */
export function simulateIncomingContact(channel: ContactChannel = 'voice'): void {
  if (!MOCK_MODE) return;
  mockCounter += 1;
  const samples = [
    { name: 'Marie Dubois', detail: '+33 6 12 34 56 78', skill: 'Support FR' },
    { name: 'James Carter', detail: 'james.carter@example.com', skill: 'Billing EN' },
    { name: 'Sofia Rossi', detail: 'Order #48213', skill: 'Sales IT' },
  ];
  const pick = samples[mockCounter % samples.length];
  const contact: Contact = {
    id: `mock-${mockCounter}`,
    channel,
    status: 'offered',
    customerName: pick.name,
    customerDetail: pick.detail,
    skill: pick.skill,
    startedAt: new Date().getTime(),
  };
  mockContacts.set(contact.id, contact);
  useContactStore.getState().upsertContact(contact);
}

function mockTransition(id: string, status: ContactStatus): void {
  const c = mockContacts.get(id);
  if (!c) return;
  const updated = { ...c, status };
  mockContacts.set(id, updated);
  const store = useContactStore.getState();
  if (status === 'ended') {
    store.removeContact(id);
    mockContacts.delete(id);
    useAgentStore.getState().setState('Available');
  } else {
    store.upsertContact(updated);
    if (status === 'active') useAgentStore.getState().setState('OnContact');
  }
}

function mockToggleMute(id: string): void {
  const c = mockContacts.get(id);
  if (!c) return;
  const updated = { ...c, muted: !c.muted };
  mockContacts.set(id, updated);
  useContactStore.getState().upsertContact(updated);
}
