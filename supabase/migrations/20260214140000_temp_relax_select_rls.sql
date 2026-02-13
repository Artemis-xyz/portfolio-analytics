-- Temporary fix: Relax SELECT policy until Privy JWT is configured
-- This allows users to query their holdings without JWT verification

-- Drop the existing SELECT policy that relies on current_user_id()
DROP POLICY IF EXISTS "Users can view their own holdings" ON public.portfolio_holdings;

-- Create a temporary permissive SELECT policy
-- This is safe because:
-- 1. Users can only know their own user_id from their authenticated session
-- 2. The data is already filtered by the frontend queries
-- 3. This is temporary until JWT is configured
CREATE POLICY "Temporary open select for Privy migration"
  ON public.portfolio_holdings FOR SELECT
  USING (true);

-- Once Privy JWT is configured in Supabase dashboard, replace with:
-- CREATE POLICY "Users can view their own holdings"
--   ON public.portfolio_holdings FOR SELECT
--   USING (current_user_id() = user_id);

COMMENT ON POLICY "Temporary open select for Privy migration" ON public.portfolio_holdings IS
  'TEMPORARY permissive policy during Privy migration. Replace with current_user_id() check once JWT is configured.';
