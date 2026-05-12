/**
 * Schedule list — all active schedules for a patient, grouped by medication.
 * Route params: patientId, patientName
 */
import { SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSchedulesForPatient } from '../../../src/hooks/useSchedules';
import {
  DAY_LABELS,
  FREQUENCY_LABELS,
  formatDays,
  formatTimes,
} from '../../../src/utils/scheduleUtils';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';
import type { ScheduleWithMedication } from '../../../src/services/supabase/schedules';

export default function ScheduleListScreen() {
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
  }>();

  const { data: schedules = [], isLoading, error } = useSchedulesForPatient(patientId);

  // Group by medication name
  const grouped = schedules.reduce<Record<string, ScheduleWithMedication[]>>(
    (acc, s) => {
      const key = s.medications?.name ?? 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    },
    {}
  );

  const sections = Object.entries(grouped).map(([title, data]) => ({ title, data }));

  const handleAdd = (medicationId?: string, medicationName?: string) => {
    router.push({
      pathname: '/(caregiver)/schedules/new',
      params: { patientId, patientName, medicationId, medicationName },
    });
  };

  const handleEdit = (schedule: ScheduleWithMedication) => {
    router.push({
      pathname: '/(caregiver)/schedules/[id]',
      params: {
        id: schedule.id,
        patientId,
        patientName,
        medicationId: schedule.medication_id,
      },
    });
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.headerBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Schedules</Text>
          {patientName ? (
            <Text style={styles.subtitle} numberOfLines={1}>{patientName}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => handleAdd()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Add schedule"
        >
          <Text style={[styles.headerBtnText, styles.addText]}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText} accessibilityRole="alert">
            Could not load schedules.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            sections.length === 0 && styles.listEmpty,
          ]}
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <TouchableOpacity
                onPress={() =>
                  handleAdd(data[0]?.medication_id, title)
                }
                accessibilityRole="button"
                accessibilityLabel={`Add schedule for ${title}`}
              >
                <Text style={styles.sectionAddBtn}>+ Add time</Text>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item }) => (
            <ScheduleRow schedule={item} onPress={() => handleEdit(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No schedules yet</Text>
              <Text style={styles.emptyBody}>
                Tap &quot;+ Add&quot; to create the first schedule for {patientName ?? 'this patient'}.
              </Text>
            </View>
          }
          accessibilityLabel="Schedule list"
        />
      )}
    </View>
  );
}

// ── ScheduleRow ───────────────────────────────────────────────────────────────

function ScheduleRow({
  schedule,
  onPress,
}: {
  schedule: ScheduleWithMedication;
  onPress: () => void;
}) {
  const timesLabel = formatTimes(schedule.times_of_day);
  const daysLabel = formatDays(schedule.days_of_week);
  const freqLabel = FREQUENCY_LABELS[schedule.frequency_type];

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${freqLabel}, ${timesLabel}, ${daysLabel}`}
      accessibilityHint="Double tap to edit this schedule"
    >
      <View style={styles.rowDetails}>
        <Text style={styles.freqLabel}>{freqLabel}</Text>
        <Text style={styles.timesText}>🕐 {timesLabel}</Text>
        {schedule.days_of_week && schedule.days_of_week.length > 0 ? (
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, i) => (
              <View
                key={i}
                style={[
                  styles.dayChip,
                  schedule.days_of_week!.includes(i) && styles.dayChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    schedule.days_of_week!.includes(i) && styles.dayChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.dateRange}>
          From {schedule.start_date}
          {schedule.end_date ? ` to ${schedule.end_date}` : ' (ongoing)'}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  headerBtn: { minWidth: 60, paddingVertical: 6 },
  headerBtnText: {
    fontSize: FontSizes.caregiver.body,
    color: '#FFFFFF',
    fontWeight: FontWeights.semibold,
  },
  addText: { textAlign: 'right' },
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
  list: { padding: 16 },
  listEmpty: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: FontSizes.caregiver.title,
    fontWeight: FontWeights.bold,
    color: Colors.light.onBackground,
  },
  sectionAddBtn: {
    fontSize: FontSizes.caregiver.label,
    color: Colors.light.primary,
    fontWeight: FontWeights.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  rowDetails: { flex: 1, gap: 4 },
  freqLabel: {
    fontSize: FontSizes.caregiver.body,
    fontWeight: FontWeights.semibold,
    color: Colors.light.onBackground,
  },
  timesText: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.secondary,
  },
  daysRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  dayChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: Colors.light.border,
  },
  dayChipActive: { backgroundColor: Colors.light.primary },
  dayChipText: {
    fontSize: 11,
    color: Colors.light.secondary,
    fontWeight: FontWeights.medium,
  },
  dayChipTextActive: { color: '#FFFFFF' },
  dateRange: {
    fontSize: FontSizes.caregiver.label,
    color: Colors.light.secondary,
    marginTop: 2,
  },
  chevron: { fontSize: 24, color: Colors.light.secondary, marginLeft: 8 },
  emptyTitle: {
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold,
    color: Colors.light.onBackground,
  },
  emptyBody: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.secondary,
    textAlign: 'center',
    lineHeight: FontSizes.caregiver.body * 1.5,
  },
  errorText: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.danger,
    textAlign: 'center',
  },
});
