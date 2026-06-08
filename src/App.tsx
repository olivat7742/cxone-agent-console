// App.tsx
//
// Top-level component. Sets up the MUI theme and decides which screen to show:
// the login page until the agent is connected, then the console.

import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { useAgentStore } from './store/agentStore';
import { LoginPage } from './pages/LoginPage';
import { ConsolePage } from './pages/ConsolePage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0a6cff' },
  },
});

function App() {
  const connected = useAgentStore((s) => s.connected);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {connected ? <ConsolePage /> : <LoginPage />}
    </ThemeProvider>
  );
}

export default App;
