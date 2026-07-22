-- Convert monetary columns from floating point to fixed precision.
-- PostgreSQL rounds existing values to two decimal places during the cast.
ALTER TABLE "Quote"
  ALTER COLUMN "subtotal" TYPE DECIMAL(10,2) USING ROUND("subtotal"::numeric, 2),
  ALTER COLUMN "discount" TYPE DECIMAL(10,2) USING ROUND("discount"::numeric, 2),
  ALTER COLUMN "tax" TYPE DECIMAL(10,2) USING ROUND("tax"::numeric, 2),
  ALTER COLUMN "total" TYPE DECIMAL(10,2) USING ROUND("total"::numeric, 2),
  ALTER COLUMN "costEstimate" TYPE DECIMAL(10,2) USING ROUND("costEstimate"::numeric, 2),
  ALTER COLUMN "estimatedMargin" TYPE DECIMAL(10,2) USING ROUND("estimatedMargin"::numeric, 2);

ALTER TABLE "QuoteItem"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(10,2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "costPrice" TYPE DECIMAL(10,2) USING ROUND("costPrice"::numeric, 2),
  ALTER COLUMN "discount" TYPE DECIMAL(10,2) USING ROUND("discount"::numeric, 2),
  ALTER COLUMN "total" TYPE DECIMAL(10,2) USING ROUND("total"::numeric, 2);

ALTER TABLE "QuoteVersion"
  ALTER COLUMN "total" TYPE DECIMAL(10,2) USING ROUND("total"::numeric, 2);

ALTER TABLE "ServiceOrderItem"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(10,2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "total" TYPE DECIMAL(10,2) USING ROUND("total"::numeric, 2);

ALTER TABLE "ServiceOrderMaterial"
  ALTER COLUMN "costPrice" TYPE DECIMAL(10,2) USING ROUND("costPrice"::numeric, 2),
  ALTER COLUMN "salePrice" TYPE DECIMAL(10,2) USING ROUND("salePrice"::numeric, 2);

ALTER TABLE "AccountsReceivable"
  ALTER COLUMN "totalValue" TYPE DECIMAL(10,2) USING ROUND("totalValue"::numeric, 2),
  ALTER COLUMN "receivedValue" TYPE DECIMAL(10,2) USING ROUND("receivedValue"::numeric, 2),
  ALTER COLUMN "pendingValue" TYPE DECIMAL(10,2) USING ROUND("pendingValue"::numeric, 2);

ALTER TABLE "AccountsPayable"
  ALTER COLUMN "value" TYPE DECIMAL(10,2) USING ROUND("value"::numeric, 2);

ALTER TABLE "FinancialTransaction"
  ALTER COLUMN "value" TYPE DECIMAL(10,2) USING ROUND("value"::numeric, 2);

ALTER TABLE "BankAccount"
  ALTER COLUMN "balance" TYPE DECIMAL(10,2) USING ROUND("balance"::numeric, 2);

ALTER TABLE "Product"
  ALTER COLUMN "costPrice" TYPE DECIMAL(10,2) USING ROUND("costPrice"::numeric, 2),
  ALTER COLUMN "salePrice" TYPE DECIMAL(10,2) USING ROUND("salePrice"::numeric, 2);

ALTER TABLE "Contract"
  ALTER COLUMN "value" TYPE DECIMAL(10,2) USING ROUND("value"::numeric, 2);

ALTER TABLE "ContractItem"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(10,2) USING ROUND("unitPrice"::numeric, 2);
