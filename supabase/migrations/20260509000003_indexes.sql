-- CareSync Performance Indexes
-- Optimized for the most frequent query patterns:
-- 1. Scheduler: find upcoming pending events
-- 2. Patient: view own history (most recent first)
-- 3. Caregiver: adherence reports + alert inbox

-- medication_events: scheduler query — upcoming pending events
-- Partial index: only indexes 'pending' rows (most are taken/missed over time)
CREATE INDEX idx_events_pending_scheduled
    ON public.medication_events (scheduled_time)
    WHERE status = 'pending';

-- medication_events: patient history view — most recent first
CREATE INDEX idx_events_patient_time
    ON public.medication_events (patient_id, scheduled_time DESC);

-- medication_events: caregiver adherence queries — by medication over time
CREATE INDEX idx_events_medication_time
    ON public.medication_events (medication_id, scheduled_time DESC);

-- medication_events: scheduler overdue detection — status + time
CREATE INDEX idx_events_status_time
    ON public.medication_events (status, scheduled_time);

-- alerts: caregiver unread inbox — partial index for common filter
CREATE INDEX idx_alerts_caregiver_unread
    ON public.alerts (caregiver_id, created_at DESC)
    WHERE is_read = FALSE;

-- alerts: full inbox including read alerts
CREATE INDEX idx_alerts_caregiver_all
    ON public.alerts (caregiver_id, created_at DESC);

-- patient_caregiver_relationships: find active caregivers for a patient (alert fanout)
CREATE INDEX idx_relationships_patient_active
    ON public.patient_caregiver_relationships (patient_id, status)
    WHERE status = 'active';

-- patient_caregiver_relationships: find patients for a caregiver (dashboard list)
CREATE INDEX idx_relationships_caregiver_active
    ON public.patient_caregiver_relationships (caregiver_id, status)
    WHERE status = 'active';

-- medication_schedules: active schedules only (scheduler query)
CREATE INDEX idx_schedules_active
    ON public.medication_schedules (medication_id)
    WHERE is_active = TRUE;

-- push_tokens: token lookup by user (notification delivery)
CREATE INDEX idx_push_tokens_user
    ON public.push_tokens (user_id);

-- medications: active medications for a patient (caregiver management list)
CREATE INDEX idx_medications_patient_active
    ON public.medications (patient_id)
    WHERE is_active = TRUE;
