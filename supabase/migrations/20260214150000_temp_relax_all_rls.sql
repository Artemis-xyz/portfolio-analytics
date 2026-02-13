-- Temporary fix: Relax all RLS policies until Privy JWT is configured
-- This allows the app to function while JWT configuration is pending

-- PROFILES TABLE
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Temporary open select for profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Temporary open update for profiles"
  ON public.profiles FOR UPDATE
  USING (true);

-- PLAID_ITEMS TABLE
DROP POLICY IF EXISTS "Users can view their own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can delete their own plaid items" ON public.plaid_items;

CREATE POLICY "Temporary open select for plaid_items"
  ON public.plaid_items FOR SELECT
  USING (true);

CREATE POLICY "Temporary open delete for plaid_items"
  ON public.plaid_items FOR DELETE
  USING (true);

-- PORTFOLIO_HOLDINGS UPDATE/DELETE
DROP POLICY IF EXISTS "Users can update their own holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Users can delete their own holdings" ON public.portfolio_holdings;

CREATE POLICY "Temporary open update for holdings"
  ON public.portfolio_holdings FOR UPDATE
  USING (true);

CREATE POLICY "Temporary open delete for holdings"
  ON public.portfolio_holdings FOR DELETE
  USING (true);

-- Add comments
COMMENT ON POLICY "Temporary open select for profiles" ON public.profiles IS
  'TEMPORARY permissive policy. Replace with current_user_id() check once JWT is configured.';

COMMENT ON POLICY "Temporary open select for plaid_items" ON public.plaid_items IS
  'TEMPORARY permissive policy. Replace with current_user_id() check once JWT is configured.';
