-- ============================================================
-- 2026-06-30 — Drop the unused `plan` column from organizations
--
-- Context: SpliceForge pivoted from SaaS to open-source (AGPL-3.0).
-- The `plan` column was a placeholder for future billing tiers
-- ('trial' | 'pro' | 'enterprise') but was never read by application
-- logic. Removing it eliminates dead schema.
--
-- Safe to run multiple times: uses IF EXISTS.
-- ============================================================

ALTER TABLE organizations DROP COLUMN IF EXISTS plan;
