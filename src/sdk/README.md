# sdk/

Wrapper around the CXone Agent SDK.

Keep all direct calls to the raw CXone Agent SDK in this folder. The rest of
the app should import from here, never from the SDK directly. This isolates SDK
changes to one place and makes testing easier.

Typical files:
- `agentClient.ts` — initialize the SDK session, expose action methods
  (setAvailable, acceptContact, hold, transfer, endContact)
- `events.ts` — subscribe to SDK events and forward them to the store
