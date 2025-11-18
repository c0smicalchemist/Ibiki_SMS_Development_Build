-- Migration: Change from single phone number to multiple phone numbers
-- Version: 11.1
-- Date: 2025-11-18

-- Drop the old single phone number column
ALTER TABLE client_profiles DROP COLUMN IF EXISTS assigned_phone_number;

-- Add the new phone numbers array column
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS assigned_phone_numbers text[];

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS client_profiles_assigned_phone_numbers_idx 
ON client_profiles USING GIN (assigned_phone_numbers);
