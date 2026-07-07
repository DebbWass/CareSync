-- CareSync — notification-pipeline hardening (M4)
--
-- medication_events.notified_at marks that the patient's reminder push was
-- successfully handed to the push provider. Without it, every 5-minute
-- scheduler run re-sends pushes for all events inside the upcoming window —
-- patients received duplicate reminders for the same dose.

ALTER TABLE public.medication_events
    ADD COLUMN notified_at TIMESTAMPTZ;

-- The immutability trigger whitelists updatable columns — notified_at is
-- pipeline state (like status), not dose identity, so it joins the list.
CREATE OR REPLACE FUNCTION public.enforce_event_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'medication_events is an immutable audit log — DELETE is not allowed'
            USING ERRCODE = 'raise_exception';
    END IF;

    IF NEW.id             IS DISTINCT FROM OLD.id
       OR NEW.schedule_id    IS DISTINCT FROM OLD.schedule_id
       OR NEW.medication_id  IS DISTINCT FROM OLD.medication_id
       OR NEW.patient_id     IS DISTINCT FROM OLD.patient_id
       OR NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time
       OR NEW.created_at     IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'medication_events identity columns are immutable — only status, taken_time, snooze_count, notes and notified_at may change'
            USING ERRCODE = 'raise_exception';
    END IF;

    RETURN NEW;
END;
$$;

-- Scheduler push query: pending events not yet notified, due soon
CREATE INDEX idx_events_pending_unnotified
    ON public.medication_events (scheduled_time)
    WHERE status = 'pending' AND notified_at IS NULL;
