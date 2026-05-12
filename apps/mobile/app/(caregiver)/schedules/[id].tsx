/**
 * Edit/deactivate a medication schedule.
 * Route params: id, patientId, patientName, medicationId
 */
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeactivateSchedule, useSchedule, useUpdateSchedule } from '../../../src/hooks/useSchedules';
import {
  DAY_LABELS,
  FREQUENCY_LABELS,
  formatTimes,
  isValidDate,
  isValidTime,
} from '../../../src/utils/scheduleUtils';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';
import type { FrequencyType } from '../../../src/types';

export default function EditScheduleScreen() {
  const router = useRouter();
  const { id, patientId = '', medicationId = '' } =
    useLocalSearchParams<{
      id: string;
      patientId: string;
      patientName: string;
      medicationId: string;
    }>();

  const { data: schedule, isLoading } = useSchedule(id);
  const updateMutation = useUpdateSchedule(medicationId, patientId);
  const deactivateMutation = useDeactivateSchedule(medicationId, patientId);

  // Track edits without useEffect/setState anti-pattern
  const [edits, setEdits] = useState<{
    times_of_day?: string[];
    days_of_week?: number[];
    start_date?: string;
    end_date?: string;
  }>({});
  const [error, setError] = useState('');

  const times = edits.times_of_day ?? schedule?.times_of_day ?? [];
  const days = edits.days_of_week ?? schedule?.days_of_week ?? [];
  const startDate = edits.start_date ?? schedule?.start_date ?? '';
  const endDate = edits.end_date ?? schedule?.end_date ?? '';
  const isDirty = Object.keys(edits).length > 0;

  const freq: FrequencyType = schedule?.frequency_type ?? 'daily';
  const showDays = freq === 'weekly' || freq === 'custom';

  const handleTimeChange = (index: number, value: string) => {
    setEdits((e) => ({
      ...e,
      times_of_day: (e.times_of_day ?? times).map((t, i) =>
        i === index ? value : t
      ),
    }));
  };

  const toggleDay = (day: number) => {
    const current = edits.days_of_week ?? days;
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    setEdits((e) => ({ ...e, days_of_week: next }));
  };

  const handleSave = () => {
    if (times.some((t) => !isValidTime(t))) {
      setError('All times must be HH:MM (24-hour format).'); return;
    }
    if (startDate && !isValidDate(startDate)) {
      setError('Start date must be YYYY-MM-DD.'); return;
    }
    if (endDate && !isValidDate(endDate)) {
      setError('End date must be YYYY-MM-DD.'); return;
    }

    setError('');
    updateMutation.mutate(
      { id: id!, input: { ...edits, days_of_week: showDays ? days : null } },
      {
        onSuccess: () => router.back(),
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to update schedule.');
        },
      }
    );
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Remove Schedule',
      `Remove this ${FREQUENCY_LABELS[freq]} schedule (${formatTimes(times)})? Future reminders from this schedule will stop.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            deactivateMutation.mutate(id!, {
              onSuccess: () => router.back(),
              onError: (err: unknown) => {
                setError(
                  err instanceof Error ? err.message : 'Failed to remove schedule.'
                );
              },
            }),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!schedule) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Schedule not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          <Text style={styles.title}>Edit Schedule</Text>
          <Text style={styles.subtitle}>{FREQUENCY_LABELS[freq]}</Text>
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
          <Text style={styles.fieldLabel}>Times of Day (HH:MM 24-hour)</Text>
          {times.map((t, i) => (
            <TextInput
              key={i}
              value={t}
              onChangeText={(v) => handleTimeChange(i, v)}
              placeholder="08:00"
              keyboardType="numbers-and-punctuation"
              mode="outlined"
              style={styles.input}
              accessibilityLabel={`Time slot ${i + 1}`}
              maxLength={5}
            />
          ))}

          {showDays && (
            <>
              <Text style={styles.fieldLabel}>Days of Week</Text>
              <View style={styles.daysRow}>
                {DAY_LABELS.map((label, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dayChip,
                      days.includes(i) && styles.dayChipActive,
                    ]}
                    onPress={() => toggleDay(i)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: days.includes(i) }}
                    accessibilityLabel={label}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        days.includes(i) && styles.dayChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
          <TextInput
            value={startDate}
            onChangeText={(v) => setEdits((e) => ({ ...e, start_date: v }))}
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
            onChangeText={(v) => setEdits((e) => ({ ...e, end_date: v }))}
            placeholder="Leave blank for ongoing"
            keyboardType="numbers-and-punctuation"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="End date, optional"
            maxLength={10}
          />

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSave}
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending || deactivateMutation.isPending || !isDirty}
            style={styles.saveButton}
            contentStyle={styles.buttonContent}
          >
            Save Changes
          </Button>

          <Button
            mode="outlined"
            onPress={handleDeactivate}
            loading={deactivateMutation.isPending}
            disabled={updateMutation.isPending || deactivateMutation.isPending}
            style={styles.removeButton}
            contentStyle={styles.buttonContent}
            textColor={Colors.light.danger}
          >
            Remove Schedule
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  flex: { flex: 1 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12, backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
  },
  headerBtn: { minWidth: 70, paddingVertical: 6 },
  headerBtnText: { fontSize: FontSizes.caregiver.body, color: '#FFFFFF' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold, color: '#FFFFFF',
  },
  subtitle: {
    fontSize: FontSizes.caregiver.label, color: '#FFFFFF', opacity: 0.85, marginTop: 2,
  },
  form: { padding: 20, gap: 10 },
  fieldLabel: {
    fontSize: FontSizes.caregiver.body, fontWeight: FontWeights.semibold,
    color: Colors.light.onBackground, marginTop: 6,
  },
  input: { backgroundColor: Colors.light.background },
  daysRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dayChip: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: Colors.light.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  dayChipActive: { borderColor: Colors.light.primary, backgroundColor: Colors.light.primary },
  dayChipText: { fontSize: 12, color: Colors.light.secondary, fontWeight: FontWeights.medium },
  dayChipTextActive: { color: '#FFFFFF', fontWeight: FontWeights.bold },
  errorText: { color: Colors.light.danger, fontSize: FontSizes.caregiver.body },
  backLink: { color: Colors.light.primary, fontSize: FontSizes.caregiver.body, fontWeight: FontWeights.semibold },
  saveButton: { marginTop: 8, borderRadius: 8 },
  removeButton: { borderRadius: 8, borderColor: Colors.light.danger },
  buttonContent: { height: 52 },
});
