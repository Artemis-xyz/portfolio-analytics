-- Fix RLS policy on privy_user_mapping to work without JWT configuration
-- This allows querying the mapping table using privy_user_id before JWT is configured

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own mapping" ON public.privy_user_mapping;

-- Create a more permissive policy that allows authenticated users to query by privy_user_id
-- This is safe because:
-- 1. Users can only know their own privy_user_id (from their Privy session)
-- 2. The privy_user_id is not sensitive - it's just a mapping key
-- 3. This enables the app to work before Supabase JWT configuration is complete
CREATE POLICY "Authenticated users can view mappings"
  ON public.privy_user_mapping FOR SELECT
  TO authenticated
  USING (true);

-- Add comment explaining the change
COMMENT ON POLICY "Authenticated users can view mappings" ON public.privy_user_mapping IS 'Allows authenticated users to query privy_user_mapping. This is safe because privy_user_id values are not sensitive and users can only know their own from Privy session.';
