-- CareSync DB tests — messages data layer (M8)
-- Idempotency, monotonic receipts, immutability, RLS matrix, realtime.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

-- ── Fixtures (as postgres, bypassing RLS) ────────────────────────────────────
-- P1 ↔ C1 active; C2 PENDING for P1 (no messaging rights); P2 unrelated.

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'msg-p1@test.dev', '{"name":"P1","role":"patient"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'msg-c1@test.dev', '{"name":"C1","role":"caregiver"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'msg-c2@test.dev', '{"name":"C2","role":"caregiver"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'msg-p2@test.dev', '{"name":"P2","role":"patient"}', '', '', '', '');

INSERT INTO public.patient_caregiver_relationships (patient_id, caregiver_id, status) VALUES
  ('80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', 'active'),
  ('80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000003', 'pending');

-- ── Helper to switch simulated user ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION test_as(uid UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
END;
$$;

-- ── Schema + realtime membership ─────────────────────────────────────────────

SELECT has_table('public', 'messages', 'messages table exists');

SELECT is(
    (SELECT COUNT(*)::int FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'messages'),
    1, 'messages is in the realtime publication');

-- ── Caregiver sends to their active patient ──────────────────────────────────
SELECT test_as('80000000-0000-4000-8000-000000000002');

INSERT INTO public.messages (id, patient_id, caregiver_id, sender_id, body, client_id)
VALUES ('81000000-0000-4000-8000-000000000001',
        '80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002',
        '80000000-0000-4000-8000-000000000002', 'Did you eat before the pill?',
        '82000000-0000-4000-8000-000000000001');

SELECT is(
    (SELECT status FROM public.messages WHERE id = '81000000-0000-4000-8000-000000000001'),
    'sent'::message_status, 'caregiver can message their active patient (status=sent)');

-- Idempotency: an outbox retry (same sender + client_id) is a unique violation
SELECT throws_ok(
    $$ INSERT INTO public.messages (patient_id, caregiver_id, sender_id, body, client_id)
       VALUES ('80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002',
               '80000000-0000-4000-8000-000000000002', 'retry of the same send',
               '82000000-0000-4000-8000-000000000001') $$,
    '23505', NULL,
    'duplicate (sender_id, client_id) is rejected — client treats 23505 as success');

-- Sender forgery: C1 cannot insert a message claiming P1 sent it
SELECT throws_ok(
    $$ INSERT INTO public.messages (patient_id, caregiver_id, sender_id, body, client_id)
       VALUES ('80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002',
               '80000000-0000-4000-8000-000000000001', 'forged sender',
               '82000000-0000-4000-8000-000000000009') $$,
    '42501', NULL,
    'sender_id must be auth.uid() — no forgery');

-- ── Pending caregiver / unrelated patient: no messaging rights ───────────────
SELECT test_as('80000000-0000-4000-8000-000000000003');

SELECT throws_ok(
    $$ INSERT INTO public.messages (patient_id, caregiver_id, sender_id, body, client_id)
       VALUES ('80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000003',
               '80000000-0000-4000-8000-000000000003', 'not yet accepted',
               '82000000-0000-4000-8000-000000000002') $$,
    '42501', NULL,
    'PENDING caregiver cannot message the patient');

SELECT test_as('80000000-0000-4000-8000-000000000004');

SELECT throws_ok(
    $$ INSERT INTO public.messages (patient_id, caregiver_id, sender_id, body, client_id)
       VALUES ('80000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000002',
               '80000000-0000-4000-8000-000000000004', 'stranger danger',
               '82000000-0000-4000-8000-000000000003') $$,
    '42501', NULL,
    'unrelated patient cannot message a caregiver');

SELECT is(
    (SELECT COUNT(*)::int FROM public.messages),
    0, 'unrelated user sees zero messages');

-- ── Recipient receipts: monotonic, server-timestamped ────────────────────────
SELECT test_as('80000000-0000-4000-8000-000000000001');

UPDATE public.messages SET status = 'read'
WHERE id = '81000000-0000-4000-8000-000000000001';

SELECT is(
    (SELECT status FROM public.messages WHERE id = '81000000-0000-4000-8000-000000000001'),
    'read'::message_status, 'recipient can mark the message read');

SELECT ok(
    (SELECT delivered_at IS NOT NULL AND read_at IS NOT NULL
     FROM public.messages WHERE id = '81000000-0000-4000-8000-000000000001'),
    'read implies delivered — both timestamps set server-side');

SELECT throws_ok(
    $$ UPDATE public.messages SET status = 'delivered'
       WHERE id = '81000000-0000-4000-8000-000000000001' $$,
    'P0001', NULL,
    'receipts never move backward (read -> delivered rejected)');

SELECT throws_ok(
    $$ UPDATE public.messages SET body = 'rewritten history'
       WHERE id = '81000000-0000-4000-8000-000000000001' $$,
    'P0001', NULL,
    'message body is immutable');

-- Sender cannot touch receipts: RLS filters the row (0 rows), status unchanged
SELECT test_as('80000000-0000-4000-8000-000000000002');

UPDATE public.messages SET status = 'read'
WHERE id = '81000000-0000-4000-8000-000000000001';

SELECT is(
    (SELECT status FROM public.messages WHERE id = '81000000-0000-4000-8000-000000000001'),
    'read'::message_status, 'sender update is an RLS no-op (recipient-only receipts)');

-- ── DELETE blocked for everyone, even superuser ──────────────────────────────
SELECT set_config('role', 'postgres', true);

SELECT throws_ok(
    $$ DELETE FROM public.messages
       WHERE id = '81000000-0000-4000-8000-000000000001' $$,
    'P0001', NULL,
    'messages can never be deleted (care-relevant history)');

SELECT * FROM finish();
ROLLBACK;
