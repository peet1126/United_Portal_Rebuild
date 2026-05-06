import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
