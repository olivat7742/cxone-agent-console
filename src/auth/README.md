# auth/

OAuth login logic for CXone.

Handles getting an access token from the CXone token endpoint and storing it
for the SDK and REST API calls. Confirm the exact flow on the CXone Developer
Portal (developer.niceincontact.com) before coding.

Typical files:
- `login.ts` — perform the OAuth flow, return a token
- `tokenStore.ts` — hold and refresh the token

Note: never hard-code secrets in frontend code. Plan a small token-broker
backend for anything beyond local testing.
