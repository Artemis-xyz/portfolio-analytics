-- Add short position support to portfolio_holdings
-- This migration adds a position_direction column to track long vs short positions

-- Add position_direction column with constraint
ALTER TABLE public.portfolio_holdings
  ADD COLUMN IF NOT EXISTS position_direction TEXT DEFAULT 'long'
  CHECK (position_direction IN ('long', 'short'));

-- Update existing holdings to explicitly set 'long'
UPDATE public.portfolio_holdings
SET position_direction = 'long'
WHERE position_direction IS NULL;

-- Handle edge case: convert any negative quantities to shorts
UPDATE public.portfolio_holdings
SET position_direction = 'short', quantity = ABS(quantity)
WHERE quantity < 0;

-- Enforce positive quantities going forward
ALTER TABLE public.portfolio_holdings
  ADD CONSTRAINT quantity_must_be_positive CHECK (quantity >= 0);

-- Add index for performance on direction queries
CREATE INDEX IF NOT EXISTS idx_holdings_position_direction
  ON public.portfolio_holdings(position_direction);

-- Add comment for documentation
COMMENT ON COLUMN public.portfolio_holdings.position_direction IS
  'Direction of the position: long (owns security) or short (borrowed and sold security)';
