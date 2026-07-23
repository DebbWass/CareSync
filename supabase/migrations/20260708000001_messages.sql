-- CareSync — Urgent patient↔caregiver messaging: data layer (M8)
--
-- Design (from the approved plan):
-- * client_id idempotency: the sending device generates a UUID per message;
--   UNIQUE(sender_id, client_id) makes an offline-outbox retry a 23505,
--   which the client treats as success — exactly-once delivery semantics.
-- * Receipts are monotonic: sent → delivered → read, trigger-enforced.
--   Timestamps are set server-side on transition so devices with wrong
--   clocks cannot corrupt receipt ordering.
-- * Only the RECIPIENT advances status; only status may ever change
--   (body and identity are frozen; messages are never deleted — like
--   medication_events, this is care-relevant history).
-- * Realtime: the table joins the supabase_realtime publication; delivery
--   respects RLS (verified live — see scripts/verify-realtime.mjs).
-- * INSERT webhook → message-push Edge Function (same GUC + pg_net wiring
--   as the caregiver-alert webhook; silent no-op until env is configured).

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUM + TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');

CREATE TABLE public.messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The conversation pair. Fixed per message; RLS scopes both directions.
    patient_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Who sent it — must be one side of the pair
    sender_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    -- Client-generated idempotency key (offline outbox retries)
    client_id    UUID NOT NULL,
    status       message_status NOT NULL DEFAULT 'sent',
    delivered_at TIMESTAMPTZ,
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_sender_in_pair
        CHECK (sender_id IN (patient_id, caregiver_id)),
    CONSTRAINT messages_pair_distinct
        CHECK (patient_id <> caregiver_id),
    -- The exactly-once guarantee: a retried outbox send is a duplicate here
    CONSTRAINT messages_client_dedup UNIQUE (sender_id, client_id)
);

-- Conversation reads: newest messages for a pair; unread badge per recipient
CREATE INDEX idx_messages_pair_created
    ON public.messages (patient_id, caregiver_id, created_at DESC);
CREATE INDEX idx_messages_unread
    ON public.messages (patient_id, caregiver_id)
    WHERE status <> 'read';

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: immutability + monotonic receipts
-- Binds every role including service_role (triggers ignore RLS bypass).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_message_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_rank INT;
    new_rank INT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'messages are never deleted — care-relevant history'
            USING ERRCODE = 'raise_exception';
    END IF;

    IF NEW.id           IS DISTINCT FROM OLD.id
       OR NEW.patient_id   IS DISTINCT FROM OLD.patient_id
       OR NEW.caregiver_id IS DISTINCT FROM OLD.caregiver_id
       OR NEW.sender_id    IS DISTINCT FROM OLD.sender_id
       OR NEW.body         IS DISTINCT FROM OLD.body
       OR NEW.client_id    IS DISTINCT FROM OLD.client_id
       OR NEW.created_at   IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'message content and identity are immutable — only status may change'
            USING ERRCODE = 'raise_exception';
    END IF;

    old_rank := CASE OLD.status WHEN 'sent' THEN 0 WHEN 'delivered' THEN 1 ELSE 2 END;
    new_rank := CASE NEW.status WHEN 'sent' THEN 0 WHEN 'delivered' THEN 1 ELSE 2 END;

    IF new_rank < old_rank THEN
        RAISE EXCEPTION 'message status can only move forward (sent -> delivered -> read)'
            USING ERRCODE = 'raise_exception';
    END IF;

    -- Server-authoritative receipt timestamps: set on transition, then frozen.
    -- read implies delivered (a read message was necessarily delivered).
    IF new_rank >= 1 AND OLD.delivered_at IS NULL THEN
        NEW.delivered_at := NOW();
    ELSE
        NEW.delivered_at := OLD.delivered_at;
    END IF;

    IF new_rank = 2 AND OLD.read_at IS NULL THEN
        NEW.read_at := NOW();
    ELSE
        NEW.read_at := OLD.read_at;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER messages_no_delete
    BEFORE DELETE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.enforce_message_transitions();

CREATE TRIGGER messages_limit_update
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.enforce_message_transitions();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Both sides of the conversation can read it
CREATE POLICY "messages_select" ON public.messages
    FOR SELECT USING (
        patient_id = auth.uid() OR caregiver_id = auth.uid()
    );

-- Sending: you must be the sender, a member of the pair, and the pair must be
-- an ACTIVE care relationship (revoked/pending caregivers cannot message)
CREATE POLICY "messages_insert" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND (
            (caregiver_id = auth.uid() AND public.is_caregiver_for(patient_id))
            OR (
                patient_id = auth.uid()
                AND EXISTS (
                    SELECT 1 FROM public.patient_caregiver_relationships
                    WHERE patient_id = auth.uid()
                      AND caregiver_id = messages.caregiver_id
                      AND status = 'active'
                )
            )
        )
    );

-- Receipts: only the RECIPIENT advances status (the trigger constrains WHAT
-- can change; this policy constrains WHO)
CREATE POLICY "messages_update_recipient" ON public.messages
    FOR UPDATE
    USING (
        (patient_id = auth.uid() OR caregiver_id = auth.uid())
        AND sender_id <> auth.uid()
    )
    WITH CHECK (
        (patient_id = auth.uid() OR caregiver_id = auth.uid())
        AND sender_id <> auth.uid()
    );

-- No DELETE policy — and the trigger blocks it for service_role too

-- The blanket GRANTs in the RLS migration ran before this table existed
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────────────────────

-- FULL replica identity: realtime evaluates RLS against the whole row for
-- UPDATE events (read receipts in M9); the default identity only carries the
-- primary key, which would silently drop those events.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ─────────────────────────────────────────────────────────────────────────────
-- Webhook: INSERT → message-push Edge Function
-- Same environment wiring as the caregiver-alert webhook (GUCs
-- app.supabase_url / app.service_role_key; silent no-op until configured —
-- never blocks the INSERT).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_message_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_url TEXT := current_setting('app.supabase_url', true);
    srk      TEXT := current_setting('app.service_role_key', true);
BEGIN
    IF base_url IS NULL OR srk IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM net.http_post(
        url     := base_url || '/functions/v1/message-push',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || srk
        ),
        body    := jsonb_build_object(
            'type',   'INSERT',
            'table',  'messages',
            'schema', 'public',
            'record', to_jsonb(NEW)
        )
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER messages_push_on_insert
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_message_push();
