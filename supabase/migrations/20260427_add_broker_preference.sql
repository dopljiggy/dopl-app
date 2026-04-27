-- Add broker preference column to profiles (doplers only).
-- Stores a simple broker name string for deep-link CTAs.
-- No OAuth, no account linking — just "which broker do you use?"
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trading_broker_preference TEXT;
