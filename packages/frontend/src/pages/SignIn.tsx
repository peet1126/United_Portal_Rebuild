import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signIn } from 'aws-amplify/auth';
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
import { useAuth } from '../context/AuthContext';

export function SignIn() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn({ username: email, password });
      await refresh();
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>United Portal</Typography>
        <Typography variant="body2" color="text.secondary">Sign in to your account</Typography>

        {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            fullWidth
            autoFocus
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="current-password"
          />
          <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mt: 1 }}>
            {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
          </Button>
        </Box>

        <Typography variant="body2">
          Don&apos;t have an account?{' '}
          <Link component={RouterLink} to="/signup">Sign up</Link>
        </Typography>
      </Box>
    </Container>
  );
}
