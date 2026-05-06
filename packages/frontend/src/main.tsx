import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Amplify } from 'aws-amplify';
import App from './App';
import { amplifyConfig } from './amplify-config';
import { AuthProvider } from './context/AuthContext';

Amplify.configure(amplifyConfig);

const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
