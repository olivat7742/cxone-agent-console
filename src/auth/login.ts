// login.ts
//
// Performs the OAuth flow against CXone and returns an access token.
//
// Right now this is a MOCK that returns a fake token so you can test the UI.
//
// REAL FLOW (confirm exact details on developer.niceincontact.com):
//   1. POST your Access Key + Secret (or OAuth client credentials) to the
//      CXone token endpoint.
//   2. Receive an access token plus the base URIs for the APIs.
//   3. Return the token; store it via tokenStore.setToken().
// Use Axios here once you have the real endpoint.

import { setToken } from './tokenStore';

export interface LoginResult {
  token: string;
  agentName: string;
}

export async function login(username: string, _password: string): Promise<LoginResult> {
  // MOCK: pretend the credentials are valid and return a fake token.
  // Replace with a real Axios POST to the CXone token endpoint.
  const fakeToken = 'mock-token-' + btoa(username).slice(0, 12);
  setToken(fakeToken);
  return {
    token: fakeToken,
    agentName: username || 'Demo Agent',
  };
}
