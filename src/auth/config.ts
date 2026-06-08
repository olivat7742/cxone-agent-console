// config.ts
//
// Reads the CXone OIDC (PKCE) configuration from environment variables.
// In Vite, only variables prefixed with VITE_ are exposed to the browser.
//
// None of these values are secrets (PKCE is designed for public/browser apps),
// but they live in a gitignored .env so the repo stays clean and portable.
//
// Set them in .env (copy from .env.example):
//   VITE_CXONE_HOSTNAME      e.g. https://cxone.niceincontact.com
//   VITE_CXONE_CLIENT_ID     the client_id from your CXone app registration
//   VITE_CXONE_REDIRECT_URI  must EXACTLY match the registered redirect URI

export interface CxoneAuthConfig {
  cxoneHostname: string;
  clientId: string;
  redirectUri: string;
}

function readEnv(): Record<string, string | undefined> {
  return import.meta.env as unknown as Record<string, string | undefined>;
}

export function getAuthConfig(): CxoneAuthConfig {
  const env = readEnv();
  return {
    cxoneHostname: env.VITE_CXONE_HOSTNAME ?? '',
    clientId: env.VITE_CXONE_CLIENT_ID ?? '',
    redirectUri: env.VITE_CXONE_REDIRECT_URI ?? `${window.location.origin}/callback`,
  };
}

/** Returns the names of any required env vars that are missing. */
export function getMissingConfigKeys(): string[] {
  const env = readEnv();
  const missing: string[] = [];
  if (!env.VITE_CXONE_HOSTNAME) missing.push('VITE_CXONE_HOSTNAME');
  if (!env.VITE_CXONE_CLIENT_ID) missing.push('VITE_CXONE_CLIENT_ID');
  return missing;
}

export function isAuthConfigured(): boolean {
  return getMissingConfigKeys().length === 0;
}
