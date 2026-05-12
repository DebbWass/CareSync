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
import { useMedications } from '../../../src/hooks/useMedications';
import { useCreateSchedule } from '../../../src/hooks/useSchedules';
import {
  DAY_LABELS,
  FREQUENCY_LABELS,
  defaultTimesForFrequency,
  isValidDate,
  isValidTime,
  timeSlotsForFrequency,
  todayISO,
} from '../../../src/utils/scheduleUtils';
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
    if (!selectedMedId) { setError('Please select a medication.'); return; }
    if (times.some((t) => !isValidTime(t))) {
      setError('All times must be in HH:MM format (24-hour), e.g. 08:00 or 20:30.');
      return;
    }
    if (!isValidDate(startDate)) { setError('Start date must be YYYY-MM-DD.'); return; }
    if (endDate && !isValidDate(endDate)) { setError('End date must be YYYY-MM-DD.'); return; }
    if ((frequency === 'weekly' || frequency === 'custom') && selectedDays.length === 0) {
      setError('Please select at least one day of the week.'); return;
    }

    setError('');
    createMutation.mutate(
      {
        medication_id: selectedMedId,
        frequency_type: frequency,
        times_of_day: times,
        days_of_week:
          frequency === 'weekly' || frequency === 'custom'
            ? selectedDays
            : undefined,
        start_date: startDate,
        end_date: endDate || undefined,
      },
      {
        onSuccess: () => router.back(),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to save schedule.';
          setError(msg);
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
          accessibilityLabel="Cancel"
        >
          <Text style={styles.headerBtnText}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Add Schedule</Text>
          {patientName ? (
            <Text style={styles.subtitle}>for {patientName}</Text>
          ) : null}
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* Medication selector */}
          <Text style={styles.fieldLabel}>Medication *</Text>
          {medications.length === 0 ? (
            <Text style={styles.hintText}>
              No active medications found. Add a medication first.
            </Text>
          ) : (
            <View style={styles.chipGroup}>
              {medications.map((med) => (
                <TouchableOpacity
                  key={med.id}
                  style={[
                    styles.chip,
                    selectedMedId === med.id && styles.chipSelected,
                  ]}
                  onPress={() => setSelectedMedId(med.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedMedId === med.id }}
                  accessibilityLabel={`${med.name} ${med.dosage}`}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedMedId === med.id && styles.chipTextSelected,
                    ]}
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
          <Text style={styles.fieldLabel}>Frequency *</Text>
          <View style={styles.chipGroup}>
            {FREQUENCY_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, frequency === f && styles.chipSelected]}
                onPress={() => handleFrequencyChange(f)}
                accessibilityRole="radio"
                accessibilityState={{ checked: frequency === f }}
                accessibilityLabel={FREQUENCY_LABELS[f]}
              >
                <Text
                  style={[
                    styles.chipText,
                    frequency === f && styles.chipTextSelected,
                  ]}
                >
                  {FREQUENCY_LABELS[f]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Times of day */}
          <Text style={styles.fieldLabel}>Times of Day * (24-hour, e.g. 08:00)</Text>
          {times.map((t, i) => (
            <View key={i} style={styles.timeRow}>
              <TextInput
                value={t}
                onChangeText={(v) => handleTimeChange(i, v)}
                placeholder="08:00"
                keyboardType="numbers-and-punctuation"
                mode="outlined"
                style={styles.timeInput}
                accessibilityLabel={`Time slot ${i + 1}`}
                maxLength={5}
              />
              {times.length > minSlots && (
                <TouchableOpacity
                  onPress={() => removeTimeSlot(i)}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove time slot ${i + 1}`}
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
              accessibilityLabel="Add another time slot"
            >
              <Text style={styles.addTimeBtnText}>+ Add time slot</Text>
            </TouchableOpacity>
          )}

          {/* Days of week (weekly/custom only) */}
          {showDayPicker && (
            <>
              <Text style={styles.fieldLabel}>Days of Week *</Text>
              <View style={styles.daysRow}>
                {DAY_LABELS.map((label, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dayChip,
                      selectedDays.includes(i) && styles.dayChipActive,
                    ]}
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
          <Text style={styles.fieldLabel}>Start Date * (YYYY-MM-DD)</Text>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-01-01"
            keyboardType="numbers-and-punctuation"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Start date"
            maxLength={10}
          />

          <Text style={styles.fieldLabel}>End Date (optional)</Text>
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="Leave blank for ongoing"
            keyboardType="numbers-and-punctuation"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="End date, optional"
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
            accessibilityLabel="Save schedule"
          >
            Save Schedule
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
