/**
 * Add schedule form.
 * Route params: patientId, patientName, medicationId (optional pre-select), medicationName
 *
 * Time inputs use free-text "HH:MM" (24-hour) — simple and accessible without
 * needing a native time picker component.
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMedications } from '../../../src/hooks/useMedications';
import { useCreateSchedule } from '../../../src/hooks/useSchedules';
import {
  DAY_LABELS,
  defaultTimesForFrequency,
  isValidDate,
  isValidTime,
  timeSlotsForFrequency,
  todayISO,
} from '../../../src/utils/scheduleUtils';
import { normalizeSupabaseError } from '../../../src/services/supabase/errors';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';
import type { FrequencyType } from '../../../src/types';

const FREQUENCY_OPTIONS: FrequencyType[] = [
  'daily',
  'twice_daily',
  'three_times_daily',
  'weekly',
  'custom',
];

export default function NewScheduleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    patientId = '',
    patientName = '',
    medicationId: paramMedId = '',
  } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
    medicationId: string;
    medicationName: string;
  }>();

  const { data: medications = [] } = useMedications(patientId);

  const [selectedMedId, setSelectedMedId] = useState(paramMedId);
  const [frequency, setFrequency] = useState<FrequencyType>('daily');
  const [times, setTimes] = useState<string[]>(defaultTimesForFrequency('daily'));
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const createMutation = useCreateSchedule(selectedMedId, patientId);

  // Adjust time slots when frequency changes
  const handleFrequencyChange = (freq: FrequencyType) => {
    setFrequency(freq);
    setTimes(defaultTimesForFrequency(freq));
    if (freq !== 'weekly' && freq !== 'custom') setSelectedDays([]);
  };

  const handleTimeChange = (index: number, value: string) => {
    setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  const addTimeSlot = () => {
    setTimes((prev) => [...prev, '08:00']);
  };

  const removeTimeSlot = (index: number) => {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = () => {
    if (!selectedMedId) {
      setError(t('schedules.form.errSelectMedication'));
      return;
    }
    if (times.some((time) => !isValidTime(time))) {
      setError(t('schedules.form.errTimeFormat'));
      return;
    }
    if (!isValidDate(startDate)) {
      setError(t('schedules.form.errStartDate'));
      return;
    }
    if (endDate && !isValidDate(endDate)) {
      setError(t('schedules.form.errEndDate'));
      return;
    }
    if ((frequency === 'weekly' || frequency === 'custom') && selectedDays.length === 0) {
      setError(t('schedules.form.errSelectDay'));
      return;
    }

    setError('');
    createMutation.mutate(
      {
        medication_id: selectedMedId,
        frequency_type: frequency,
        times_of_day: times,
        days_of_week: frequency === 'weekly' || frequency === 'custom' ? selectedDays : undefined,
        start_date: startDate,
        end_date: endDate || undefined,
      },
      {
        onSuccess: () => router.back(),
        onError: (err: unknown) => {
          setError(t(normalizeSupabaseError(err).messageKey));
        },
      }
    );
  };

  const showDayPicker = frequency === 'weekly' || frequency === 'custom';
  const canAddTime = frequency === 'custom' || frequency === 'weekly';
  const minSlots = timeSlotsForFrequency(frequency);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Text style={styles.headerBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('schedules.form.addTitle')}</Text>
          {patientName ? (
            <Text style={styles.subtitle}>
              {t('schedules.form.forPatient', { name: patientName })}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {/* Medication selector */}
          <Text style={styles.fieldLabel}>{t('schedules.form.medicationLabel')}</Text>
          {medications.length === 0 ? (
            <Text style={styles.hintText}>{t('schedules.form.noMedications')}</Text>
          ) : (
            <View style={styles.chipGroup}>
              {medications.map((med) => (
                <TouchableOpacity
                  key={med.id}
                  style={[styles.chip, selectedMedId === med.id && styles.chipSelected]}
                  onPress={() => setSelectedMedId(med.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedMedId === med.id }}
                  accessibilityLabel={`${med.name} ${med.dosage}`}
                >
                  <Text
                    style={[styles.chipText, selectedMedId === med.id && styles.chipTextSelected]}
                  >
                    {med.name}
                  </Text>
                  <Text
                    style={[
                      styles.chipSubtext,
                      selectedMedId === med.id && styles.chipSubtextSelected,
                    ]}
                  >
                    {med.dosage}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Frequency selector */}
          <Text style={styles.fieldLabel}>{t('schedules.form.frequencyLabel')}</Text>
          <View style={styles.chipGroup}>
            {FREQUENCY_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, frequency === f && styles.chipSelected]}
                onPress={() => handleFrequencyChange(f)}
                accessibilityRole="radio"
                accessibilityState={{ checked: frequency === f }}
                accessibilityLabel={t(`schedules.frequency.${f}`)}
              >
                <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>
                  {t(`schedules.frequency.${f}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Times of day */}
          <Text style={styles.fieldLabel}>{t('schedules.form.timesLabel')}</Text>
          {times.map((time, i) => (
            <View key={i} style={styles.timeRow}>
              <TextInput
                value={time}
                onChangeText={(v) => handleTimeChange(i, v)}
                placeholder="08:00"
                keyboardType="numbers-and-punctuation"
                mode="outlined"
                style={styles.timeInput}
                accessibilityLabel={t('schedules.form.timeSlotA11y', { number: i + 1 })}
                maxLength={5}
              />
              {times.length > minSlots && (
                <TouchableOpacity
                  onPress={() => removeTimeSlot(i)}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('schedules.form.removeTimeSlotA11y', { number: i + 1 })}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {canAddTime && (
            <TouchableOpacity
              onPress={addTimeSlot}
              style={styles.addTimeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('schedules.form.addTimeSlotA11y')}
            >
              <Text style={styles.addTimeBtnText}>{t('schedules.form.addTimeSlot')}</Text>
            </TouchableOpacity>
          )}

          {/* Days of week (weekly/custom only) */}
          {showDayPicker && (
            <>
              <Text style={styles.fieldLabel}>{t('schedules.form.daysLabel')}</Text>
              <View style={styles.daysRow}>
                {DAY_LABELS.map((label, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayChip, selectedDays.includes(i) && styles.dayChipActive]}
                    onPress={() => toggleDay(i)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selectedDays.includes(i) }}
                    accessibilityLabel={label}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        selectedDays.includes(i) && styles.dayChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Date range */}
          <Text style={styles.fieldLabel}>{t('schedules.form.startDateLabel')}</Text>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-01-01"
            keyboardType="numbers-and-punctuation"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('schedules.form.startDateA11y')}
            maxLength={10}
          />

          <Text style={styles.fieldLabel}>{t('schedules.form.endDateLabel')}</Text>
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder={t('schedules.form.endDatePlaceholder')}
            keyboardType="numbers-and-punctuation"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('schedules.form.endDateA11y')}
            maxLength={10}
          />

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSave}
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
            style={styles.saveButton}
            contentStyle={styles.buttonContent}
            accessibilityLabel={t('schedules.form.saveA11y')}
          >
            {t('schedules.form.saveButton')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerBtn: { minWidth: 70, paddingVertical: 6 },
  headerBtnText: {
    fontSize: FontSizes.caregiver.body,
    color: '#FFFFFF',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: FontSizes.caregiver.label,
    color: '#FFFFFF',
    opacity: 0.85,
    marginTop: 2,
  },
  form: { padding: 20, gap: 10 },
  fieldLabel: {
    fontSize: FontSizes.caregiver.body,
    fontWeight: FontWeights.semibold,
    color: Colors.light.onBackground,
    marginTop: 6,
  },
  hintText: {
    fontSize: FontSizes.caregiver.label,
    color: Colors.light.secondary,
    fontStyle: 'italic',
  },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  chipSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#EBF3FB',
  },
  chipText: {
    fontSize: FontSizes.caregiver.label,
    color: Colors.light.secondary,
    fontWeight: FontWeights.medium,
  },
  chipTextSelected: {
    color: Colors.light.primary,
    fontWeight: FontWeights.bold,
  },
  chipSubtext: {
    fontSize: 11,
    color: Colors.light.secondary,
    marginTop: 2,
  },
  chipSubtextSelected: { color: Colors.light.primary },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { flex: 1, backgroundColor: Colors.light.background },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: FontWeights.bold },
  addTimeBtn: { paddingVertical: 8 },
  addTimeBtnText: {
    color: Colors.light.primary,
    fontSize: FontSizes.caregiver.body,
    fontWeight: FontWeights.semibold,
  },
  daysRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  dayChipActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary,
  },
  dayChipText: {
    fontSize: 12,
    color: Colors.light.secondary,
    fontWeight: FontWeights.medium,
  },
  dayChipTextActive: { color: '#FFFFFF', fontWeight: FontWeights.bold },
  input: { backgroundColor: Colors.light.background },
  errorText: { color: Colors.light.danger, fontSize: FontSizes.caregiver.body },
  saveButton: { marginTop: 8, borderRadius: 8 },
  buttonContent: { height: 52 },
});
