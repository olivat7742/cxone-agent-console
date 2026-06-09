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

import { CXoneAcdClient, CXoneVoiceContact, CXoneWorkItemContact } from '@nice-devone/acd-sdk';
import { CXoneVoiceClient } from '@nice-devone/voice-sdk';
import { CXoneDigitalClient, CXoneDigitalContact } from '@nice-devone/digital-sdk';
import { CXoneClient } from '@nice-devone/agent-sdk';
import { AgentSessionStatus, MediaType } from '@nice-devone/common-sdk';
import type {
  AgentState,
  AgentStateEvent,
  AgentSessionResponse,
  CXoneDisposition,
  CXoneTag,
  TagsResponse,
  CXoneDispositionDetails,
} from '@nice-devone/common-sdk';
import type { CXoneDigitalReplyRequest } from '@nice-devone/common-sdk';
import { useAgentStore } from '../store/agentStore';
import { useContactStore } from '../store/contactStore';
import { useOutcomeStore } from '../store/outcomeStore';
import { useDigitalStore } from '../store/digitalStore';
import type {
  AgentStateName,
  Contact,
  ContactChannel,
  ContactStatus,
  DigitalContactView,
  DigitalMessage,
  DispositionOption,
} from './types';

/** Set true to use the in-app simulator instead of the real SDK (UI demos). */
export const MOCK_MODE = false;

// Verbose SDK diagnostics. Off by default to keep the console clean (and avoid
// logging customer data like ANI). Flip to true when debugging the SDK, e.g.
// when resuming the digital messaging work.
const DEBUG = false;
function debugLog(...args: unknown[]): void {
  if (DEBUG) console.info(...args);
}

// --- Live contact instances (real mode) ------------------------------------
// We keep the live CXoneVoiceContact objects so action methods can call their
// own hold()/resume()/mute()/end() helpers.
const liveContacts = new Map<string, CXoneVoiceContact>();
let acdSubscribed = false;
let sessionInitStarted = false;
// Raw tag objects for the current contact, kept so saveTags can send full CXoneTag payloads.
let rawTags: CXoneTag[] = [];
// Live digital contact instances, kept so we can changeStatus() on them.
const liveDigital = new Map<string, CXoneDigitalContact>();
let digitalSubscribed = false;
// Last applied message signature per case, so polling only updates the store
// when the thread actually changed (avoids needless re-renders).
const lastDigitalSig = new Map<string, string>();
// Poll timer that keeps open digital threads fresh. The SDK's new-message push
// is unreliable here, so we poll the DFO detail for open conversations.
let digitalPollTimer: ReturnType<typeof setInterval> | null = null;
const DIGITAL_POLL_MS = 3500;

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

function mapWorkItemContact(c: CXoneWorkItemContact): Contact {
  // CXoneWorkItemContact extends the base contact; fields are accessed
  // defensively since work items carry fewer voice-specific properties.
  const w = c as unknown as {
    contactID: string;
    status?: string;
    skill?: string;
    skillName?: string;
    customerName?: string;
    startTime?: Date;
    isRequireManualAccept?: boolean;
    allowDispositions?: boolean;
    requireDisposition?: boolean;
  };
  return {
    id: w.contactID,
    channel: 'work_item',
    status: mapContactStatus(w.status),
    customerName: w.customerName || w.skillName || 'Work item',
    skill: w.skillName || w.skill || undefined,
    startedAt: w.startTime ? new Date(w.startTime).getTime() : new Date().getTime(),
    requiresAccept: w.isRequireManualAccept === true,
    allowDispositions: w.allowDispositions,
    requiresDisposition: w.requireDisposition,
  };
}

// Shared lifecycle handling for ACD contacts (voice + work item).
function applyAcdContactUpdate(mapped: Contact): void {
  const store = useContactStore.getState();
  if (mapped.status === 'ended') {
    const alreadySaved = useOutcomeStore.getState().savedContactIds.includes(mapped.id);
    if (mapped.allowDispositions && !alreadySaved) {
      store.upsertContact({ ...mapped, status: 'wrapup' });
    } else {
      store.removeContact(mapped.id);
    }
  } else {
    store.upsertContact(mapped);
  }
}

// --- Digital mapping helpers ------------------------------------------------

function mapDigitalMessages(messages: unknown): DigitalMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((m, i) => {
    const msg = m as { id?: string; messageId?: string; direction?: string; messageContent?: { text?: string } };
    return {
      id: msg.id || msg.messageId || String(i),
      direction: msg.direction || 'inbound',
      text: msg.messageContent?.text || '',
    };
  });
}

function mapDigitalContact(c: CXoneDigitalContact): DigitalContactView {
  const d = c as unknown as {
    caseId: string;
    customerName?: string;
    channelType?: string;
    channel?: { name?: string };
    status?: unknown;
    messages?: unknown;
  };
  return {
    caseId: d.caseId,
    channel: d.channelType || d.channel?.name || 'digital',
    customerName: d.customerName || 'Customer',
    status: String(d.status ?? ''),
    messages: mapDigitalMessages(d.messages),
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
    debugLog('[CXone] agentState', {
      state: event?.currentState?.state,
      cxoneState: event?.currentState?.cxoneState,
      reason: event?.currentState?.reason,
    });
    const name = mapAgentState(event);
    if (name) {
      useAgentStore.getState().setState(name);
      // When the agent returns to Available, ACW is over: clear any lingering
      // wrap-up contact (saved or timed out) so the outcome panel disappears.
      if (name === 'Available') {
        const contactStore = useContactStore.getState();
        const wrapups = contactStore.contacts.filter((c) => c.status === 'wrapup');
        if (wrapups.length) {
          wrapups.forEach((c) => contactStore.removeContact(c.id));
          useOutcomeStore.getState().clear();
        }
      }
    }
  });

  // Voice contact lifecycle -> contact store.
  acd.contactManager.voiceContactUpdateEvent.subscribe((c: CXoneVoiceContact) => {
    // DIAGNOSTIC (temporary): logs raw contact fields so we can verify the
    // status mapping against real CXone values on the first live call.
    debugLog('[CXone] voiceContactUpdate', {
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
    applyAcdContactUpdate(mapped);
    if (mapped.status === 'ended') liveContacts.delete(mapped.id);
  });

  // Work item contact lifecycle -> contact store (same lifecycle as voice).
  acd.contactManager.workItemContactUpdateEvent.subscribe((c: CXoneWorkItemContact) => {
    const mapped = mapWorkItemContact(c);
    debugLog('[CXone] workItemContactUpdate', { id: mapped.id, status: mapped.status });
    applyAcdContactUpdate(mapped);
  });

  // Available dispositions for the current contact -> outcome store.
  acd.contactManager.onDispositionEvent.subscribe((data) => {
    if (Array.isArray(data)) {
      const list = (data as CXoneDisposition[]).map((d) => ({
        id: d.dispositionId,
        name: d.dispositionName,
      }));
      debugLog('[CXone] dispositions', list.length);
      useOutcomeStore.getState().setDispositions(list);
    }
  });

  // Available tags for the current contact -> outcome store.
  acd.contactManager.onTagsEvent.subscribe((data) => {
    const resp = data as TagsResponse;
    if (resp && Array.isArray(resp.tags)) {
      rawTags = resp.tags;
      debugLog('[CXone] tags', resp.tags.length);
      useOutcomeStore.getState().setTags(resp.tags.map((t) => ({ id: t.tagId, name: t.tagName })));
    }
  });

  // Session lifecycle -> start WebRTC when the session is up.
  acd.session.onAgentSessionChange.subscribe((res: AgentSessionResponse) => {
    debugLog('[CXone] sessionChange', res.status);
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
    debugLog('[CXone] agentLeg', legAny.status, legAny.agentLegId);
    CXoneVoiceClient.instance.handleAgentLegEvent(leg);
    if (legAny.status === 'Dialing' && legAny.agentLegId) {
      CXoneVoiceClient.instance.connectAgentLeg(legAny.agentLegId);
    }
  });

  // WebRTC voice client status. These are the REAL success/failure signals for
  // the audio path (per the SDK docs), connectServer returning is not enough.
  CXoneVoiceClient.instance.onConnectionStatusChanged.subscribe((conn) => {
    debugLog('[CXone] voiceConnectionStatus', conn);
  });
  CXoneVoiceClient.instance.onCallStatusChanged.subscribe((call) => {
    debugLog('[CXone] voiceCallStatus', call);
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
    debugLog('[CXone] initWebRTC: fetching agent settings + user info...');
    const client = CXoneClient.instance as unknown as {
      agentSetting: { getAgentSettings: () => Promise<unknown> };
      cxoneUser: { getUserDetails: () => Promise<unknown> };
    };
    const agentSettings = await client.agentSetting.getAgentSettings();
    const userInfo = (await client.cxoneUser.getUserDetails()) as { icAgentId?: string };
    const acdAgentId = userInfo?.icAgentId;
    debugLog('[CXone] initWebRTC: acdAgentId=', acdAgentId, 'hasSettings=', Boolean(agentSettings));
    if (!acdAgentId || !agentSettings) {
      console.warn('[CXone] initWebRTC: missing agentId or settings, cannot connect WebRTC');
      return;
    }
    debugLog('[CXone] initWebRTC: connecting WebRTC server...');
    CXoneVoiceClient.instance.connectServer(
      String(acdAgentId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agentSettings as any,
      getAudioElement(),
      'CXone Agent Console',
    );
    debugLog('[CXone] initWebRTC: connectServer called OK');
  } catch (e) {
    console.warn('[agentClient] WebRTC connect failed (verify on live call):', e);
  }
}

// --- Public API -------------------------------------------------------------

// --- Digital (messaging) ----------------------------------------------------

function subscribeDigitalEvents(): void {
  if (digitalSubscribed) return;
  digitalSubscribed = true;
  const dm = CXoneDigitalClient.instance.digitalContactManager;

  // A digital contact arrived or was updated. The event-published contact is
  // often "bare" (no channel/thread/messages), so we render what we have for the
  // contact list and pull the authoritative thread from the DFO detail endpoint.
  dm.onDigitalContactEvent.subscribe((c: CXoneDigitalContact) => {
    const view = mapDigitalContact(c);
    liveDigital.set(view.caseId, c);
    useDigitalStore.getState().upsertContact(view);
    void refreshDigitalMessages(view.caseId);
    ensureDigitalPolling();
  });

  // A new message on a case -> fast-path refresh. The event id mapping is not
  // reliable, so refresh all open threads; the poll below is the safety net.
  dm.onDigitalContactNewMessageEvent.subscribe((evt: unknown) => {
    debugLog('[CXone] digitalNewMessage', evt);
    refreshAllOpenDigital();
  });
}

/** Refresh the message thread for every open digital conversation. */
function refreshAllOpenDigital(): void {
  for (const c of useDigitalStore.getState().contacts) void refreshDigitalMessages(c.caseId);
}

/** Start polling open digital threads (idempotent). Stops itself when none remain. */
function ensureDigitalPolling(): void {
  if (digitalPollTimer) return;
  digitalPollTimer = setInterval(() => {
    if (useDigitalStore.getState().contacts.length === 0) {
      stopDigitalPolling();
      return;
    }
    refreshAllOpenDigital();
  }, DIGITAL_POLL_MS);
}

/** Stop the digital polling timer. */
function stopDigitalPolling(): void {
  if (digitalPollTimer) {
    clearInterval(digitalPollTimer);
    digitalPollTimer = null;
  }
}

/**
 * Shape of the DFO `/dfo/3.0/contacts/{caseId}/detail` payload we rely on.
 * Verified against the live response: channel.id and thread.idOnExternalPlatform
 * are what the outbound reply needs, and messages[] feeds the thread view.
 */
interface DigitalDetail {
  channel?: { id?: string };
  thread?: { idOnExternalPlatform?: string };
  messages?: unknown;
  customerContact?: { skillId?: string | number };
}

/**
 * Fetch the full DFO case detail. The contact published via onDigitalContactEvent
 * can be bare, so this REST detail (the same endpoint the SDK uses internally) is
 * our source of truth for channel id, thread and messages. Never throws.
 */
async function fetchDigitalDetail(caseId: string): Promise<DigitalDetail | null> {
  try {
    const svc = CXoneDigitalClient.instance.digitalContactManager.digitalContactService;
    const resp = await svc.getDigitalContactDetails(caseId);
    // HttpResponse exposes a `data` getter that parses the JSON body.
    const data = (resp as unknown as { data?: DigitalDetail }).data;
    return data ?? null;
  } catch (e) {
    console.warn('[CXone] getDigitalContactDetails failed:', e);
    return null;
  }
}

/** Refresh a case's message thread in the store from the DFO detail. Only writes
 *  to the store when the thread actually changed, to avoid needless re-renders. */
async function refreshDigitalMessages(caseId: string): Promise<void> {
  const detail = await fetchDigitalDetail(caseId);
  if (!detail) return;
  const msgs = mapDigitalMessages(detail.messages);
  const sig = `${msgs.length}:${msgs.map((m) => m.id).join('|')}`;
  if (lastDigitalSig.get(caseId) === sig) return;
  lastDigitalSig.set(caseId, sig);
  useDigitalStore.getState().setMessages(caseId, msgs);
}

/** Initialize digital engagement and subscribe to digital events. Never throws. */
export async function initDigital(): Promise<void> {
  if (MOCK_MODE) return;
  try {
    debugLog('[CXone] initDigital: initDigitalEngagement...');
    await CXoneDigitalClient.instance.initDigitalEngagement();
    subscribeDigitalEvents();
    debugLog('[CXone] initDigital: ready');
  } catch (e) {
    console.warn('[agentClient] initDigital failed (verify on first digital contact):', e);
  }
}

/**
 * Send a reply on a digital contact. We fetch the DFO case detail to get the
 * channel id and thread (the event-published contact can be bare), then post the
 * outbound reply directly via the digital contact service.
 */
export async function sendDigitalReply(caseId: string, text: string): Promise<void> {
  const detail = await fetchDigitalDetail(caseId);
  const channelId = detail?.channel?.id;
  const threadIdOnExternalPlatform = detail?.thread?.idOnExternalPlatform;
  if (!channelId) {
    throw new Error('Conversation is still loading; try again in a moment.');
  }
  // messageContent shape per the SDK: { type: 'TEXT', payload: { text } }.
  const request = {
    messageContent: { type: 'TEXT', payload: { text } },
    thread: { idOnExternalPlatform: threadIdOnExternalPlatform },
    recipients: [],
  } as unknown as CXoneDigitalReplyRequest;
  const svc = CXoneDigitalClient.instance.digitalContactManager.digitalContactService;
  await svc.postOutboundReply(request, channelId, crypto.randomUUID());
  // Reflect the just-sent message in the thread without waiting for an event.
  void refreshDigitalMessages(caseId);
}

/** Resolve a digital contact (shortcut for completing wrap-up as 'resolved'). */
export async function resolveDigitalContact(caseId: string): Promise<void> {
  await completeDigitalWrapUp(caseId, 'resolved');
}

// --- Digital wrap-up (ACW) --------------------------------------------------
// Note: digital tags are intentionally not supported. The ACD tags endpoint
// (contacts/{id}/tags) rejects a digital caseId with "InvalidContactId", so the
// wrap-up offers disposition + notes only (both verified working for digital).

/** The disposition service used for digital contacts. */
function digitalDispositionService() {
  return CXoneDigitalClient.instance.digitalContactManager.dispositionService;
}

/**
 * Begin wrap-up for a digital contact: fetch the disposition options for the
 * contact's skill and flag the contact as in wrap-up. Does NOT close the case;
 * that happens on completeDigitalWrapUp. Never throws.
 */
export async function beginDigitalWrapUp(caseId: string): Promise<void> {
  let dispositions: DispositionOption[] = [];
  try {
    const detail = await fetchDigitalDetail(caseId);
    const skillId = detail?.customerContact?.skillId;
    if (skillId != null) {
      const svc = digitalDispositionService();
      const disps = await svc.getDispositions(String(skillId), MediaType.DIGITAL, caseId);
      if (Array.isArray(disps)) {
        dispositions = disps.map((d) => ({ id: d.dispositionId, name: d.dispositionName }));
      }
    }
    console.info('[CXone] digital wrap-up options', { caseId, skillId, dispositions: dispositions.length });
  } catch (e) {
    console.warn('[agentClient] beginDigitalWrapUp: failed to load options:', e);
  }
  useDigitalStore.getState().patchContact(caseId, { wrapup: true, dispositions });
}

/** Save the disposition (+ optional comment) for a digital contact. */
export async function saveDigitalOutcome(
  caseId: string,
  dispositionId: number | null,
  notes: string,
): Promise<void> {
  if (dispositionId == null) return;
  const details = {
    primaryDispositionId: dispositionId,
    primaryDispositionNotes: notes,
  } as CXoneDispositionDetails;
  await digitalDispositionService().saveDisposition(caseId, details);
}

/**
 * Finish wrap-up: set the chosen case status (e.g. 'resolved', 'closed') and
 * clear the contact from the UI. Defaults to 'resolved'.
 */
export async function completeDigitalWrapUp(caseId: string, status: string = 'resolved'): Promise<void> {
  const contact = liveDigital.get(caseId);
  if (contact) {
    await (contact as unknown as { changeStatus: (s: string) => Promise<unknown> }).changeStatus(status);
  }
  liveDigital.delete(caseId);
  lastDigitalSig.delete(caseId);
  useDigitalStore.getState().removeContact(caseId);
  if (useDigitalStore.getState().contacts.length === 0) stopDigitalPolling();
}

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
    debugLog('[CXone] initSession: already started, skipping duplicate');
    return;
  }
  sessionInitStarted = true;
  try {
    debugLog('[CXone] initSession: initAcdEngagement...');
    await CXoneAcdClient.instance.initAcdEngagement();
    subscribeToAcdEvents();
    try {
      await CXoneAcdClient.instance.session.joinSession();
      debugLog('[CXone] initSession: joinSession SUCCESS (joined existing session)');
    } catch {
      // No existing session to join; start a new WebRTC voice session.
      debugLog('[CXone] initSession: joinSession failed, starting new WebRTC session...');
      await CXoneAcdClient.instance.session.startSession({
        stationId: '',
        stationPhoneNumber: 'WebRTC',
      });
      debugLog('[CXone] initSession: startSession(WebRTC) SUCCESS');
    }
    // Load the team's unavailable reason codes for the state dropdown.
    void loadUnavailableCodes();
    // Initialize digital engagement (chat/email/social) in parallel.
    void initDigital();
  } catch (e) {
    sessionInitStarted = false; // allow a retry on next login attempt
    console.warn('[agentClient] initSession failed (verify after first login):', e);
  }
}

/** Load the agent team's unavailable reason codes into the store. */
export async function loadUnavailableCodes(): Promise<void> {
  if (MOCK_MODE) return;
  try {
    const res = await CXoneAcdClient.instance.agentStateService.getTeamUnavailableCodes();
    if (Array.isArray(res)) {
      // Only active, agent-selectable codes (exclude system ACW codes).
      const codes = res.filter((c) => c.isActive && !c.isAcw).map((c) => c.reason);
      debugLog('[CXone] unavailableCodes', codes.length);
      useAgentStore.getState().setUnavailableCodes(codes);
    }
  } catch (e) {
    console.warn('[agentClient] loadUnavailableCodes failed:', e);
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
