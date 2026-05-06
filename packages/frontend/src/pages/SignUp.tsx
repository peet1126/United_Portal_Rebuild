import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signUp } from 'aws-amplify/auth';
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

export function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email, name },
        },
      });
      // Pass email in route state so ConfirmSignUp can pre-fill it.
      navigate('/confirm', { state: { email } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>Create account</Typography>

        {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Full name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            fullWidth
            autoFocus
            autoComplete="name"
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="new-password"
            helperText="Min 8 characters, upper + lower + number"
          />
          <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mt: 1 }}>
            {loading ? <CircularProgress size={22} color="inherit" /> : 'Create account'}
          </Button>
        </Box>

        <Typography variant="body2">
          Already have an account?{' '}
          <Link component={RouterLink} to="/signin">Sign in</Link>
        </Typography>
      </Box>
    </Container>
  );
}
