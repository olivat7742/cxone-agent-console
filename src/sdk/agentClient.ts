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
import type {
  AgentState,
  AgentStateEvent,
  AgentSessionResponse,
  CXoneDisposition,
  CXoneTag,
  TagsResponse,
  CXoneDispositionDetails,
} from '@nice-devone/common-sdk';
import { useAgentStore } from '../store/agentStore';
import { useContactStore } from '../store/contactStore';
import { useOutcomeStore } from '../store/outcomeStore';
import type { AgentStateName, Contact, ContactChannel, ContactStatus } from './types';

/** Set true to use the in-app simulator instead of the real SDK (UI demos). */
export const MOCK_MODE = false;

// --- Live contact instances (real mode) ------------------------------------
// We keep the live CXoneVoiceContact objects so action methods can call their
// own hold()/resume()/mute()/end() helpers.
const liveContacts = new Map<string, CXoneVoiceContact>();
let acdSubscribed = false;
let sessionInitStarted = false;
// Raw tag objects for the current contact, kept so saveTags can send full CXoneTag payloads.
let rawTags: CXoneTag[] = [];

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
    // Only require manual accept when the flag is explicitly true. Voice
    // contacts here report false (auto-answer), so we must not show Accept.
    requiresAccept: c.isRequireManualAccept === true,
    allowDispositions: c.allowDispositions,
    requiresDisposition: c.requireDisposition,
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
    console.info('[CXone] agentState', {
      state: event?.currentState?.state,
      cxoneState: event?.currentState?.cxoneState,
      reason: event?.currentState?.reason,
    });
    const name = mapAgentState(event);
    if (name) useAgentStore.getState().setState(name);
  });

  // Voice contact lifecycle -> contact store.
  acd.contactManager.voiceContactUpdateEvent.subscribe((c: CXoneVoiceContact) => {
    // DIAGNOSTIC (temporary): logs raw contact fields so we can verify the
    // status mapping against real CXone values on the first live call.
    console.info('[CXone] voiceContactUpdate', {
      contactID: c.contactID,
      status: c.status,
      isRequireManualAccept: c.isRequireManualAccept,
      customerName: c.customerName,
      ani: c.ani,
      dnis: c.dnis,
      callType: c.callType,
      isInbound: c.isInbound,
      skillName: c.skillName,
    });
    liveContacts.set(c.contactID, c);
    const mapped = mapVoiceContact(c);
    const store = useContactStore.getState();
    if (mapped.status === 'ended') {
      if (mapped.allowDispositions) {
        // Call disconnected but dispositions are allowed: keep it in wrap-up
        // (ACW) so the agent can disposition before it leaves the console.
        store.upsertContact({ ...mapped, status: 'wrapup' });
      } else {
        store.removeContact(mapped.id);
      }
      liveContacts.delete(mapped.id);
    } else {
      store.upsertContact(mapped);
    }
  });

  // Available dispositions for the current contact -> outcome store.
  acd.contactManager.onDispositionEvent.subscribe((data) => {
    if (Array.isArray(data)) {
      const list = (data as CXoneDisposition[]).map((d) => ({
        id: d.dispositionId,
        name: d.dispositionName,
      }));
      console.info('[CXone] dispositions', list.length);
      useOutcomeStore.getState().setDispositions(list);
    }
  });

  // Available tags for the current contact -> outcome store.
  acd.contactManager.onTagsEvent.subscribe((data) => {
    const resp = data as TagsResponse;
    if (resp && Array.isArray(resp.tags)) {
      rawTags = resp.tags;
      console.info('[CXone] tags', resp.tags.length);
      useOutcomeStore.getState().setTags(resp.tags.map((t) => ({ id: t.tagId, name: t.tagName })));
    }
  });

  // Session lifecycle -> start WebRTC when the session is up.
  acd.session.onAgentSessionChange.subscribe((res: AgentSessionResponse) => {
    console.info('[CXone] sessionChange', res.status);
    if (
      res.status === AgentSessionStatus.JOIN_SESSION_SUCCESS ||
      res.status === AgentSessionStatus.SESSION_START
    ) {
      void initWebRTC();
    }
  });

  // Agent leg (voice path) -> hand off to the voice client.
  acd.session.agentLegEvent.subscribe((leg) => {
    const legAny = leg as unknown as { status?: string; agentLegId?: string };
    console.info('[CXone] agentLeg', legAny.status, legAny.agentLegId);
    CXoneVoiceClient.instance.handleAgentLegEvent(leg);
    if (legAny.status === 'Dialing' && legAny.agentLegId) {
      CXoneVoiceClient.instance.connectAgentLeg(legAny.agentLegId);
    }
  });

  // WebRTC voice client status. These are the REAL success/failure signals for
  // the audio path (per the SDK docs), connectServer returning is not enough.
  CXoneVoiceClient.instance.onConnectionStatusChanged.subscribe((conn) => {
    console.info('[CXone] voiceConnectionStatus', conn);
  });
  CXoneVoiceClient.instance.onCallStatusChanged.subscribe((call) => {
    console.info('[CXone] voiceCallStatus', call);
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
    console.info('[CXone] initWebRTC: fetching agent settings + user info...');
    const client = CXoneClient.instance as unknown as {
      agentSetting: { getAgentSettings: () => Promise<unknown> };
      cxoneUser: { getUserDetails: () => Promise<unknown> };
    };
    const agentSettings = await client.agentSetting.getAgentSettings();
    const userInfo = (await client.cxoneUser.getUserDetails()) as { icAgentId?: string };
    const acdAgentId = userInfo?.icAgentId;
    console.info('[CXone] initWebRTC: acdAgentId=', acdAgentId, 'hasSettings=', Boolean(agentSettings));
    if (!acdAgentId || !agentSettings) {
      console.warn('[CXone] initWebRTC: missing agentId or settings, cannot connect WebRTC');
      return;
    }
    console.info('[CXone] initWebRTC: connecting WebRTC server...');
    CXoneVoiceClient.instance.connectServer(
      String(acdAgentId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agentSettings as any,
      getAudioElement(),
      'CXone Agent Console',
    );
    console.info('[CXone] initWebRTC: connectServer called OK');
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
  if (sessionInitStarted) {
    console.info('[CXone] initSession: already started, skipping duplicate');
    return;
  }
  sessionInitStarted = true;
  try {
    console.info('[CXone] initSession: initAcdEngagement...');
    await CXoneAcdClient.instance.initAcdEngagement();
    subscribeToAcdEvents();
    try {
      await CXoneAcdClient.instance.session.joinSession();
      console.info('[CXone] initSession: joinSession SUCCESS (joined existing session)');
    } catch {
      // No existing session to join; start a new WebRTC voice session.
      console.info('[CXone] initSession: joinSession failed, starting new WebRTC session...');
      await CXoneAcdClient.instance.session.startSession({
        stationId: '',
        stationPhoneNumber: 'WebRTC',
      });
      console.info('[CXone] initSession: startSession(WebRTC) SUCCESS');
    }
  } catch (e) {
    sessionInitStarted = false; // allow a retry on next login attempt
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

/** Save the disposition (+ optional comment) and tags for a contact. */
export async function saveOutcome(
  contactId: string,
  dispositionId: number | null,
  notes: string,
  tagIds: number[],
): Promise<void> {
  if (MOCK_MODE) return;
  const svc = CXoneAcdClient.instance.contactManager.dispositionService;
  if (dispositionId != null) {
    const details = {
      primaryDispositionId: dispositionId,
      primaryDispositionNotes: notes,
    } as CXoneDispositionDetails;
    await svc.saveDisposition(contactId, details);
  }
  if (tagIds.length) {
    const selected = rawTags.filter((t) => tagIds.includes(t.tagId));
    if (selected.length) await svc.saveTags(contactId, selected);
  }
  // Remember this contact is dispositioned so we never offer (and fail) a
  // second save during wrap-up.
  useOutcomeStore.getState().markSaved(contactId);
}

/** Complete wrap-up: remove the contact from the console and clear outcome options. */
export function completeWrapUp(id: string): void {
  useContactStore.getState().removeContact(id);
  useOutcomeStore.getState().clear();
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
