-- Phase 06 staging compatibility:
-- Ensure legacy 2min cron jobs exist before migration 20260529131457 tries to unschedule them.
-- This keeps replay idempotent on fresh staging environments.

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'cron schema not found; skipping cron compatibility setup.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-company-sync-2min') THEN
    PERFORM cron.schedule('dispatch-company-sync-2min', '0 0 1 1 *', 'SELECT 1;');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-order-sync-2min') THEN
    PERFORM cron.schedule('dispatch-order-sync-2min', '0 0 1 1 *', 'SELECT 1;');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-product-sync-2min') THEN
    PERFORM cron.schedule('dispatch-product-sync-2min', '0 0 1 1 *', 'SELECT 1;');
  END IF;
END
$$;
