
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Plaid items (linked accounts)
CREATE TABLE public.plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  item_id TEXT NOT NULL,
  institution_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plaid items"
  ON public.plaid_items FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plaid items"
  ON public.plaid_items FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plaid items"
  ON public.plaid_items FOR DELETE USING (auth.uid() = user_id);

-- Portfolio holdings
CREATE TABLE public.portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id UUID REFERENCES public.plaid_items(id) ON DELETE CASCADE,
  security_name TEXT NOT NULL,
  ticker TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  close_price NUMERIC NOT NULL DEFAULT 0,
  value NUMERIC NOT NULL DEFAULT 0,
  cost_basis NUMERIC,
  asset_type TEXT,
  institution_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own holdings"
  ON public.portfolio_holdings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own holdings"
  ON public.portfolio_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own holdings"
  ON public.portfolio_holdings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own holdings"
  ON public.portfolio_holdings FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_holdings_updated_at
  BEFORE UPDATE ON public.portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
