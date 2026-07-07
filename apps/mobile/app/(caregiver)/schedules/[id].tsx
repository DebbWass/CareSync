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
import { useTranslation } from 'react-i18next';
import {
  useDeactivateSchedule,
  useSchedule,
  useUpdateSchedule,
} from '../../../src/hooks/useSchedules';
import {
  DAY_LABELS,
  formatTimes,
  isValidDate,
  isValidTime,
} from '../../../src/utils/scheduleUtils';
import { ErrorBanner } from '../../../src/components/ui/ErrorBanner';
import { normalizeSupabaseError } from '../../../src/services/supabase/errors';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';
import type { FrequencyType } from '../../../src/types';

export default function EditScheduleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    id,
    patientId = '',
    medicationId = '',
  } = useLocalSearchParams<{
    id: string;
    patientId: string;
    patientName: string;
    medicationId: string;
  }>();

  const { data: schedule, isLoading, error: loadError, refetch } = useSchedule(id);
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
      times_of_day: (e.times_of_day ?? times).map((t, i) => (i === index ? value : t)),
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
    if (times.some((time) => !isValidTime(time))) {
      setError(t('schedules.form.errTimeFormat'));
      return;
    }
    if (startDate && !isValidDate(startDate)) {
      setError(t('schedules.form.errStartDate'));
      return;
    }
    if (endDate && !isValidDate(endDate)) {
      setError(t('schedules.form.errEndDate'));
      return;
    }

    setError('');
    updateMutation.mutate(
      { id: id!, input: { ...edits, days_of_week: showDays ? days : null } },
      {
        onSuccess: () => router.back(),
        onError: (err: unknown) => {
          setError(t(normalizeSupabaseError(err).messageKey));
        },
      }
    );
  };

  const handleDeactivate = () => {
    Alert.alert(
      t('schedules.edit.removeTitle'),
      t('schedules.edit.removeMessage', {
        frequency: t(`schedules.frequency.${freq}`),
        times: formatTimes(times),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('schedules.edit.removeConfirm'),
          style: 'destructive',
          onPress: () =>
            deactivateMutation.mutate(id!, {
              onSuccess: () => router.back(),
              onError: (err: unknown) => {
                setError(t(normalizeSupabaseError(err).messageKey));
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

  if (loadError || !schedule) {
    return (
      <View style={styles.center}>
        {loadError ? (
          <ErrorBanner error={loadError} onRetry={refetch} />
        ) : (
          <Text style={styles.errorText}>{t('schedules.edit.notFound')}</Text>
        )}
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>{t('schedules.edit.goBack')}</Text>
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
          accessibilityLabel={t('common.cancel')}
        >
          <Text style={styles.headerBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('schedules.form.editTitle')}</Text>
          <Text style={styles.subtitle}>{t(`schedules.frequency.${freq}`)}</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>{t('schedules.edit.timesLabel')}</Text>
          {times.map((time, i) => (
            <TextInput
              key={i}
              value={time}
              onChangeText={(v) => handleTimeChange(i, v)}
              placeholder="08:00"
              keyboardType="numbers-and-punctuation"
              mode="outlined"
              style={styles.input}
              accessibilityLabel={t('schedules.form.timeSlotA11y', { number: i + 1 })}
              maxLength={5}
            />
          ))}

          {showDays && (
            <>
              <Text style={styles.fieldLabel}>{t('schedules.edit.daysLabel')}</Text>
              <View style={styles.daysRow}>
                {DAY_LABELS.map((label, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayChip, days.includes(i) && styles.dayChipActive]}
                    onPress={() => toggleDay(i)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: days.includes(i) }}
                    accessibilityLabel={label}
                  >
                    <Text
                      style={[styles.dayChipText, days.includes(i) && styles.dayChipTextActive]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>{t('schedules.edit.startDateLabel')}</Text>
          <TextInput
            value={startDate}
            onChangeText={(v) => setEdits((e) => ({ ...e, start_date: v }))}
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
            onChangeText={(v) => setEdits((e) => ({ ...e, end_date: v }))}
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
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending || deactivateMutation.isPending || !isDirty}
            style={styles.saveButton}
            contentStyle={styles.buttonContent}
          >
            {t('schedules.edit.saveButton')}
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
            {t('schedules.edit.removeButton')}
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerBtn: { minWidth: 70, paddingVertical: 6 },
  headerBtnText: { fontSize: FontSizes.caregiver.body, color: '#FFFFFF' },
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
  input: { backgroundColor: Colors.light.background },
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
  dayChipActive: { borderColor: Colors.light.primary, backgroundColor: Colors.light.primary },
  dayChipText: { fontSize: 12, color: Colors.light.secondary, fontWeight: FontWeights.medium },
  dayChipTextActive: { color: '#FFFFFF', fontWeight: FontWeights.bold },
  errorText: { color: Colors.light.danger, fontSize: FontSizes.caregiver.body },
  backLink: {
    color: Colors.light.primary,
    fontSize: FontSizes.caregiver.body,
    fontWeight: FontWeights.semibold,
  },
  saveButton: { marginTop: 8, borderRadius: 8 },
  removeButton: { borderRadius: 8, borderColor: Colors.light.danger },
  buttonContent: { height: 52 },
});
