-- Migration: Remove Plaid and Add Broker CSV Upload Support
-- Description: Removes plaid_items table and plaid_item_id column, adds broker tracking fields

-- Step 1: Remove plaid_item_id foreign key constraint
ALTER TABLE public.portfolio_holdings
  DROP CONSTRAINT IF EXISTS portfolio_holdings_plaid_item_id_fkey;

-- Step 2: Drop plaid_item_id column
ALTER TABLE public.portfolio_holdings
  DROP COLUMN IF EXISTS plaid_item_id;

-- Step 3: Add new columns for broker tracking
ALTER TABLE public.portfolio_holdings
  ADD COLUMN IF NOT EXISTS broker_source TEXT,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ DEFAULT now();

-- Step 4: Add transaction tracking columns (for future transaction history)
ALTER TABLE public.portfolio_holdings
  ADD COLUMN IF NOT EXISTS last_transaction_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transaction_count INTEGER DEFAULT 0;

-- Step 5: Create indexes for batch queries
CREATE INDEX IF NOT EXISTS idx_holdings_import_batch
  ON public.portfolio_holdings(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_holdings_broker_source
  ON public.portfolio_holdings(broker_source);

-- Step 6: Update existing holdings to set broker_source
UPDATE public.portfolio_holdings
SET broker_source = COALESCE(institution_name, 'CSV Import')
WHERE broker_source IS NULL;

-- Step 7: Drop plaid_items table and its policies
DROP POLICY IF EXISTS "Users can delete their own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can insert their own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can view their own plaid items" ON public.plaid_items;
DROP TABLE IF EXISTS public.plaid_items CASCADE;

-- Note: RLS policies for UPDATE and DELETE on portfolio_holdings already exist
-- from the initial migration (lines 85-89), so users can edit and delete their holdings
