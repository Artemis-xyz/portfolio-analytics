-- Add unique constraint to prevent duplicate holdings
-- A user should not have multiple holdings with the same ticker and position_direction

-- First, remove any existing duplicates by keeping only the most recent one
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, UPPER(ticker), position_direction
      ORDER BY imported_at DESC NULLS LAST, updated_at DESC
    ) as rn
  FROM public.portfolio_holdings
  WHERE ticker IS NOT NULL
)
DELETE FROM public.portfolio_holdings
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint
-- Note: ticker can be null, so we need a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_holding_per_user
  ON public.portfolio_holdings(user_id, UPPER(ticker), position_direction)
  WHERE ticker IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_unique_holding_per_user IS
  'Ensures a user cannot have duplicate holdings for the same ticker and position direction. Case-insensitive ticker comparison.';
