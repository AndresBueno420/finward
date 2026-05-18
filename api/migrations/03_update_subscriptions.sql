-- +goose Up
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100),
  ADD COLUMN IF NOT EXISTS currency        VARCHAR(10) NOT NULL DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS start_date      DATE,
  ADD COLUMN IF NOT EXISTS end_date        DATE,
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMP WITH TIME ZONE;

-- +goose Down
ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS payment_method,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS deleted_at;
