-- Migration: Add Privy Authentication Support
-- This migration adds support for Privy authentication while maintaining backward compatibility
-- with existing Supabase Auth users

-- 1. Create privy_user_mapping table to link Privy users to Supabase users
CREATE TABLE IF NOT EXISTS public.privy_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT NOT NULL UNIQUE,
  supabase_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on mapping table
ALTER TABLE public.privy_user_mapping ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own mapping
CREATE POLICY "Users can view their own mapping"
  ON public.privy_user_mapping FOR SELECT
  USING (supabase_user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_privy_user_mapping_privy_id
  ON public.privy_user_mapping(privy_user_id);

CREATE INDEX IF NOT EXISTS idx_privy_user_mapping_supabase_id
  ON public.privy_user_mapping(supabase_user_id);


-- 2. Create function to get or create user from Privy JWT
CREATE OR REPLACE FUNCTION public.get_or_create_user_from_privy_jwt()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  privy_id TEXT;
  supabase_uid UUID;
  existing_mapping RECORD;
  new_user_id UUID;
BEGIN
  -- Extract Privy user ID from JWT (sub claim)
  privy_id := auth.jwt() ->> 'sub';

  -- If no Privy ID in JWT, return NULL
  IF privy_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if mapping already exists
  SELECT * INTO existing_mapping
  FROM public.privy_user_mapping
  WHERE privy_user_id = privy_id;

  IF existing_mapping IS NOT NULL THEN
    -- Update last login timestamp
    UPDATE public.privy_user_mapping
    SET last_login = now()
    WHERE privy_user_id = privy_id;

    RETURN existing_mapping.supabase_user_id;
  END IF;

  -- Create new Supabase user for this Privy user
  -- Note: This assumes the user doesn't exist yet
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_confirmed_at,
    recovery_token,
    last_sign_in_at,
    confirmed_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    COALESCE(auth.jwt() ->> 'email', privy_id || '@privy.local'),
    '{"provider":"privy","providers":["privy"]}'::jsonb,
    jsonb_build_object(
      'privy_user_id', privy_id,
      'display_name', COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email')
    ),
    now(),
    now(),
    '',
    now(),
    '',
    now(),
    now()
  ) RETURNING id INTO new_user_id;

  -- Create mapping entry
  INSERT INTO public.privy_user_mapping (privy_user_id, supabase_user_id)
  VALUES (privy_id, new_user_id);

  -- Profile will be auto-created by the existing trigger

  RETURN new_user_id;
END;
$$;


-- 3. Create current_user_id() function for RLS policies
-- This function supports both Supabase Auth and Privy authentication
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  supabase_uid UUID;
  privy_id TEXT;
  mapped_user_id UUID;
BEGIN
  -- First check if user is authenticated via Supabase Auth
  supabase_uid := auth.uid();
  IF supabase_uid IS NOT NULL THEN
    RETURN supabase_uid;
  END IF;

  -- Check for Privy JWT
  privy_id := auth.jwt() ->> 'sub';
  IF privy_id IS NULL OR privy_id = '' THEN
    RETURN NULL;
  END IF;

  -- Look up existing mapping
  SELECT supabase_user_id INTO mapped_user_id
  FROM public.privy_user_mapping
  WHERE privy_user_id = privy_id;

  IF mapped_user_id IS NOT NULL THEN
    -- Update last login
    UPDATE public.privy_user_mapping
    SET last_login = now()
    WHERE privy_user_id = privy_id;

    RETURN mapped_user_id;
  END IF;

  -- If no mapping exists, create user and mapping
  RETURN public.get_or_create_user_from_privy_jwt();
END;
$$;


-- 4. Update all RLS policies to use current_user_id() instead of auth.uid()

-- Profiles table policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (current_user_id() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (current_user_id() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (current_user_id() = user_id);


-- Plaid items policies
DROP POLICY IF EXISTS "Users can view their own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can insert their own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can delete their own plaid items" ON public.plaid_items;

CREATE POLICY "Users can view their own plaid items"
  ON public.plaid_items FOR SELECT
  USING (current_user_id() = user_id);

CREATE POLICY "Users can insert their own plaid items"
  ON public.plaid_items FOR INSERT
  WITH CHECK (current_user_id() = user_id);

CREATE POLICY "Users can delete their own plaid items"
  ON public.plaid_items FOR DELETE
  USING (current_user_id() = user_id);


-- Portfolio holdings policies
DROP POLICY IF EXISTS "Users can view their own holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Users can insert their own holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Users can update their own holdings" ON public.portfolio_holdings;
DROP POLICY IF EXISTS "Users can delete their own holdings" ON public.portfolio_holdings;

CREATE POLICY "Users can view their own holdings"
  ON public.portfolio_holdings FOR SELECT
  USING (current_user_id() = user_id);

CREATE POLICY "Users can insert their own holdings"
  ON public.portfolio_holdings FOR INSERT
  WITH CHECK (current_user_id() = user_id);

CREATE POLICY "Users can update their own holdings"
  ON public.portfolio_holdings FOR UPDATE
  USING (current_user_id() = user_id);

CREATE POLICY "Users can delete their own holdings"
  ON public.portfolio_holdings FOR DELETE
  USING (current_user_id() = user_id);


-- Grant necessary permissions
GRANT SELECT ON public.privy_user_mapping TO authenticated;
GRANT INSERT ON public.privy_user_mapping TO authenticated;
GRANT UPDATE ON public.privy_user_mapping TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.privy_user_mapping IS 'Maps Privy user IDs to Supabase user IDs for authentication';
COMMENT ON FUNCTION public.current_user_id() IS 'Returns the current user ID, supporting both Supabase Auth and Privy authentication';
COMMENT ON FUNCTION public.get_or_create_user_from_privy_jwt() IS 'Creates a new Supabase user and mapping entry for a Privy-authenticated user';
