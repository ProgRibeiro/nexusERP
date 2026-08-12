-- Internal facilities pricing for outsourced quote items.
-- The client-facing proposal keeps exposing only the final sale amount.
ALTER TABLE "QuoteItem"
  ADD COLUMN "markupPercentage" DECIMAL(7,2) NOT NULL DEFAULT 0;
