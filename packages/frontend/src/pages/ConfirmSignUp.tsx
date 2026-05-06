import { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  TextField,
  Typography,
} from '@mui/material';

export function ConfirmSignUp() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState<string>(state?.email ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      navigate('/signin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      await resendSignUpCode({ username: email });
      setInfo('Verification code resent — check your email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    }
  };

  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>Verify your email</Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          We sent a verification code to your email address.
        </Typography>

        {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ width: '100%' }}>{info}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Verification code"
            value={code}
            onChange={e => setCode(e.target.value)}
            required
            fullWidth
            autoFocus
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          />
          <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mt: 1 }}>
            {loading ? <CircularProgress size={22} color="inherit" /> : 'Verify account'}
          </Button>
          <Button variant="text" fullWidth onClick={handleResend} disabled={loading}>
            Resend code
          </Button>
        </Box>

        <Typography variant="body2">
          <Link component={RouterLink} to="/signin">Back to sign in</Link>
        </Typography>
      </Box>
    </Container>
  );
}
