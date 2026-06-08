# CXone Agent Console

A custom agent desktop built on the NiCE CXone Agent SDK.

Currently runs in **mock mode**: the app simulates the CXone platform so the UI
can be built and demoed before tenant credentials are wired in.

## Tech stack

- React 19 + TypeScript
- Vite (dev server and build)
- Zustand (state management)
- Axios (REST API calls)
- MUI (UI components)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173. Log in with any username (mock mode), set yourself
Available, then use "Simulate voice contact" to walk through the contact
lifecycle: accept, hold, mute, end.

## Scripts

- `npm run dev` — start the dev server with hot reload
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## Project structure

```
src/
├── sdk/          # Wrapper around the CXone Agent SDK (the only place that
│                 #   touches the SDK). Mock for now; see MOCK_MODE.
├── auth/         # OAuth login + token storage
├── store/        # Zustand state (agent state, contacts)
├── components/   # UI pieces (StateBar, ContactCard, CallControls, CustomerPanel)
├── pages/        # LoginPage, ConsolePage
└── App.tsx       # Theme + login/console routing
```

## Going live

1. In `src/sdk/agentClient.ts`, set `MOCK_MODE = false`.
2. Replace the method bodies marked `REAL` with real CXone Agent SDK calls.
3. In `src/auth/login.ts`, implement the real OAuth flow against the CXone
   token endpoint (confirm details at developer.niceincontact.com).
4. Store credentials in a `.env` file (already gitignored) or, better, behind a
   small token-broker backend. Never commit keys or secrets.
