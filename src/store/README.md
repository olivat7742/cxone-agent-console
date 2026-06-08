# store/

Global app state with Zustand.

Holds state that many components need: the agent's current state, the active
contact(s), and connection status. The SDK event handlers push updates here,
and components read from here and re-render automatically.

Typical files:
- `agentStore.ts` — agent state (Available, Unavailable, etc.)
- `contactStore.ts` — offered and active contacts
