-- Allow anon role to query privy_user_mapping and other tables
-- This is needed when using anon key instead of JWT authentication

-- PRIVY_USER_MAPPING: Allow anon to query
DROP POLICY IF EXISTS "Authenticated users can view mappings" ON public.privy_user_mapping;

CREATE POLICY "Allow anon and authenticated to view mappings"
  ON public.privy_user_mapping FOR SELECT
  USING (true);

-- PORTFOLIO_HOLDINGS: Update policies to allow anon
DROP POLICY IF EXISTS "Temporary open select for Privy migration" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Temporary open insert for Privy migration" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Temporary open update for holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Temporary open delete for holdings" ON public.portfolio_holdings;

CREATE POLICY "Temp allow all select holdings"
  ON public.portfolio_holdings FOR SELECT
  USING (true);

CREATE POLICY "Temp allow all insert holdings"
  ON public.portfolio_holdings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Temp allow all update holdings"
  ON public.portfolio_holdings FOR UPDATE
  USING (true);

CREATE POLICY "Temp allow all delete holdings"
  ON public.portfolio_holdings FOR DELETE
  USING (true);

-- PROFILES: Allow anon
DROP POLICY IF EXISTS "Temporary open select for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Temporary open update for profiles" ON public.profiles;

CREATE POLICY "Temp allow all select profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Temp allow all update profiles"
  ON public.profiles FOR UPDATE
  USING (true);

-- PLAID_ITEMS: Allow anon
DROP POLICY IF EXISTS "Temporary open select for plaid_items" ON public.plaid_items;
DROP POLICY IF EXISTS "Temporary open delete for plaid_items" ON public.plaid_items;

CREATE POLICY "Temp allow all select plaid_items"
  ON public.plaid_items FOR SELECT
  USING (true);

CREATE POLICY "Temp allow all delete plaid_items"
  ON public.plaid_items FOR DELETE
  USING (true);

COMMENT ON POLICY "Temp allow all select holdings" ON public.portfolio_holdings IS
  'TEMPORARY: Allows all roles (anon/authenticated) until JWT is configured';
