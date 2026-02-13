-- Fix user_id handling for Privy authentication
-- This migration adds triggers to automatically set user_id from JWT claims
-- for INSERT operations, ensuring Privy DID → UUID mapping happens consistently

-- Create trigger function that sets user_id from current_user_id()
CREATE OR REPLACE FUNCTION public.set_user_id_from_current_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only set user_id if it's NULL (allows service role to override)
  IF NEW.user_id IS NULL THEN
    NEW.user_id := public.current_user_id();
  END IF;

  -- Ensure user_id is set (user must be authenticated)
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine user_id. User must be authenticated.';
  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger to portfolio_holdings (CSV uploads and manual entries)
CREATE TRIGGER set_portfolio_holdings_user_id
  BEFORE INSERT ON public.portfolio_holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_from_current_user();

-- Add trigger to plaid_items (bank account connections)
CREATE TRIGGER set_plaid_items_user_id
  BEFORE INSERT ON public.plaid_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_from_current_user();

-- Add trigger to profiles (user profile creation)
CREATE TRIGGER set_profiles_user_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_from_current_user();

-- Add comment explaining the purpose
COMMENT ON FUNCTION public.set_user_id_from_current_user() IS 'Automatically sets user_id from JWT claims (current_user_id) on INSERT. Handles Privy DID to Supabase UUID mapping for all user-owned tables.';
