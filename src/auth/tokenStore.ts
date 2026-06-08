// tokenStore.ts
//
// Holds the access token in memory for the SDK and REST API calls.
// In-memory is fine for a demo. For production, consider where the token
// lives and how it refreshes, and never expose your client secret in the
// frontend (use a small token-broker backend).

let accessToken: string | null = null;

export function setToken(token: string): void {
  accessToken = token;
}

export function getToken(): string | null {
  return accessToken;
}

export function clearToken(): void {
  accessToken = null;
}
