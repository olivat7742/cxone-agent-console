// login.ts
//
// Real CXone authentication using the OpenID Connect Authorization Code flow
// with PKCE, via @nice-devone/auth-sdk. Each agent logs in with their OWN
// CXone credentials on NiCE's hosted login page. This app never sees or stores
// any password, and no client secret ships in the browser (that is the point
// of PKCE).
//
// Flow:
//   1. startLogin()      -> init settings, build the authorize URL, redirect
//                           the browser to NiCE's hosted login page.
//   2. (agent logs in on NiCE, gets redirected back to our redirectUri?code=)
//   3. completeLogin(code) -> exchange the code for a token, then start the
//                           agent session modules.
//   4. restoreSession()  -> on a page refresh, reuse the stored token if valid.

import { CXoneAuth } from '@nice-devone/auth-sdk';
import { CXoneClient } from '@nice-devone/agent-sdk';
import { getAuthConfig, isAuthConfigured } from './config';
import { initSession } from '../sdk/agentClient';

export interface SessionInfo {
  agentName: string;
}

let initialized = false;

/** Initialize the auth SDK with our settings (idempotent). */
function ensureInit(): void {
  if (initialized) return;
  const { cxoneHostname, clientId, redirectUri } = getAuthConfig();
  CXoneAuth.instance.init({ cxoneHostname, clientId, redirectUri });
  initialized = true;
}

/** Step 1: redirect the browser to NiCE's hosted login page. */
export async function startLogin(): Promise<void> {
  if (!isAuthConfigured()) {
    throw new Error('CXone auth is not configured. Set VITE_CXONE_* in your .env file.');
  }
  ensureInit();
  // 'page' = full-page redirect (vs 'popup'); 'S256' = PKCE code challenge method.
  const authorizeUrl = await CXoneAuth.instance.getAuthorizeUrl('page', 'S256');
  window.location.assign(authorizeUrl);
}

/** Step 3: exchange the authorization code for a token and start the session. */
export async function completeLogin(code: string): Promise<SessionInfo> {
  ensureInit();
  const { clientId } = getAuthConfig();
  await CXoneAuth.instance.getAccessTokenByCode({ clientId, code });
  await CXoneClient.instance.initAuthDependentModules();
  await initSession();
  return { agentName: await resolveAgentName() };
}

/** Step 4: on refresh, restore an existing valid session. Returns null if none. */
export async function restoreSession(): Promise<SessionInfo | null> {
  if (!isAuthConfigured()) return null;
  ensureInit();
  try {
    await CXoneAuth.instance.restoreData();
    const state = CXoneAuth.instance.getAuthState();
    if (!state || CXoneAuth.instance.isTokenExpired()) return null;
    await CXoneClient.instance.initAuthDependentModules();
    await initSession();
    return { agentName: await resolveAgentName() };
  } catch {
    return null;
  }
}

/** Clear local auth artifacts and return to the login screen. */
export function logout(): void {
  try {
    localStorage.clear();
  } catch {
    // ignore storage errors
  }
  window.location.assign('/');
}

/** Best-effort display name from the logged-in user's details. */
async function resolveAgentName(): Promise<string> {
  try {
    const details = (await CXoneAuth.instance.getUserDetails()) as unknown as {
      firstName?: string;
      lastName?: string;
      emailAddress?: string;
    };
    const name = [details?.firstName, details?.lastName].filter(Boolean).join(' ');
    return name || details?.emailAddress || 'Agent';
  } catch {
    return 'Agent';
  }
}
