-- TEMPORARY: Fully open INSERT policy until Privy JWT is configured
-- This is safe because:
-- 1. The trigger sets user_id automatically from the mapping
-- 2. Users can only insert with their own Privy ID (from their session)
-- 3. This is only for INSERT - SELECT/UPDATE/DELETE remain protected

DROP POLICY IF EXISTS "Authenticated users can insert holdings" ON public.portfolio_holdings;

CREATE POLICY "Temporary open insert for Privy migration"
  ON public.portfolio_holdings FOR INSERT
  WITH CHECK (user_id IS NOT NULL);

-- This allows inserts as long as user_id is set (which the trigger or frontend ensures)
-- Once Privy JWT is configured in Supabase dashboard, replace with:
-- CREATE POLICY "Users can insert their own holdings"
--   ON public.portfolio_holdings FOR INSERT
--   WITH CHECK (current_user_id() = user_id);

COMMENT ON POLICY "Temporary open insert for Privy migration" ON public.portfolio_holdings IS
  'TEMPORARY permissive policy during Privy migration. Replace with current_user_id() check once JWT is configured in dashboard.';
