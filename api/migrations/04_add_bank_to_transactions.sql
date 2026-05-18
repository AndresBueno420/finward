-- +goose Up
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank VARCHAR(100);

-- +goose Down
ALTER TABLE transactions
  DROP COLUMN IF EXISTS bank;
