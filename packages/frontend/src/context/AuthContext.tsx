import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getCurrentUser, fetchUserAttributes, type AuthUser } from 'aws-amplify/auth';

interface UserProfile {
  user: AuthUser;
  name: string;
  email: string;
}

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  // Call refresh() after sign-in or sign-out to sync context state.
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const user = await getCurrentUser();
      const attrs = await fetchUserAttributes();
      setProfile({
        user,
        name: attrs.name ?? attrs.email ?? user.username,
        email: attrs.email ?? '',
      });
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <AuthContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
