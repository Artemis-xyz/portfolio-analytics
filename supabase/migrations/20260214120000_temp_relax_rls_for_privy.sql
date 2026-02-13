-- Temporary fix: Relax RLS policies until Privy JWT is configured in Supabase dashboard
-- Once JWT is properly configured, these policies will work correctly with current_user_id()

-- Portfolio holdings: Allow authenticated users to insert holdings
-- The trigger will ensure user_id is set correctly
DROP POLICY IF EXISTS "Users can insert their own holdings" ON public.portfolio_holdings;

CREATE POLICY "Authenticated users can insert holdings"
  ON public.portfolio_holdings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Keep the SELECT/UPDATE/DELETE policies strict
-- These work because they query existing data where user_id is already set

COMMENT ON POLICY "Authenticated users can insert holdings" ON public.portfolio_holdings IS
  'Temporary permissive policy for INSERT. The set_user_id_from_current_user trigger ensures user_id is set correctly. Tighten this policy once Privy JWT is configured in Supabase dashboard.';
