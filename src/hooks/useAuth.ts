import { useState, useEffect } from "react";
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const { ready, authenticated, user: privyUser, login, logout, getAccessToken } = usePrivy();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupAuth = async () => {
      if (!ready) {
        setLoading(true);
        return;
      }

      if (!authenticated || !privyUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Get Privy access token
        const accessToken = await getAccessToken();

        if (accessToken) {
          // NOTE: Don't set session with Privy token until JWT is configured in Supabase
          // Without JWT config, setting an unrecognized token causes 406 errors
          // await supabase.auth.setSession({
          //   access_token: accessToken,
          //   refresh_token: '', // Privy handles refresh
          // });

          // Map Privy user to Supabase User shape for compatibility
          const mappedUser: User = {
            id: privyUser.id,
            app_metadata: {},
            user_metadata: {
              privy_user_id: privyUser.id,
              email: privyUser.email?.address,
              display_name: privyUser.email?.address || privyUser.id,
            },
            aud: 'authenticated',
            created_at: privyUser.createdAt?.toString() || new Date().toISOString(),
            email: privyUser.email?.address,
            phone: privyUser.phone?.number,
          } as User;

          setUser(mappedUser);
        }
      } catch (error) {
        console.error('Error setting up auth:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    setupAuth();

    // Note: Token refresh disabled until JWT is configured
    // Once JWT is configured in Supabase dashboard, uncomment the refresh logic

  }, [ready, authenticated, privyUser, getAccessToken]);

  // Maintain compatibility with existing API
  const signIn = async () => {
    await login();
    return { error: null };
  };

  const signUp = async () => {
    // Privy handles both sign in and sign up with the same flow
    await login();
    return { data: null, error: null };
  };

  const signOut = async () => {
    await logout();
    await supabase.auth.signOut();
  };

  return {
    user,
    session: user ? { user, access_token: '', refresh_token: '' } : null,
    loading,
    signIn,
    signUp,
    signOut,
  };
};
