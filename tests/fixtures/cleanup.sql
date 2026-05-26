-- Wipes test-only signups (@e2e.rosytests.com domain) so tests don't accumulate
-- orphan profiles. Run periodically (or via CI before each suite run).
-- The e2e admin account is NOT touched (different email domain).

BEGIN;
CREATE TEMP TABLE _e2e_ids AS
  SELECT id FROM rr_profiles WHERE email LIKE '%@e2e.rosytests.com';

DELETE FROM rr_gig_applications WHERE worker_id IN (SELECT id FROM _e2e_ids);
DELETE FROM rr_messages          WHERE sender_id IN (SELECT id FROM _e2e_ids) OR recipient_id IN (SELECT id FROM _e2e_ids);
DELETE FROM rr_notifications     WHERE user_id IN (SELECT id FROM _e2e_ids);
DELETE FROM rr_conversations     WHERE started_by IN (SELECT id FROM _e2e_ids);
DELETE FROM rr_vendor_profiles   WHERE id IN (SELECT id FROM _e2e_ids);
DELETE FROM rr_worker_profiles   WHERE id IN (SELECT id FROM _e2e_ids);
DELETE FROM rr_profiles          WHERE id IN (SELECT id FROM _e2e_ids);
DELETE FROM auth.users           WHERE id IN (SELECT id FROM _e2e_ids);
COMMIT;
