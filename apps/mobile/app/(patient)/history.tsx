/**
 * Patient medication history screen.
 * Shows taken/missed/snoozed events, newest first.
 */
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useEventHistory } from '../../src/hooks/useMedicationEvent';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Colors } from '../../src/constants/colors';
import { FontSizes, FontWeights } from '../../src/constants/typography';
import type { EventStatus, MedicationEvent } from '../../src/types';

// ── Status badge config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EventStatus, { label: string; icon: string }> = {
  taken: { label: 'Taken', icon: '✓' },
  missed: { label: 'Missed', icon: '✗' },
  snoozed: { label: 'Snoozed', icon: '⏱' },
  pending: { label: 'Pending', icon: '…' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PatientHistory() {
  const router = useRouter();
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;
  const { data: events = [], isLoading, error } = useEventHistory();

  const getStatusColor = (status: EventStatus) => {
    switch (status) {
      case 'taken': return theme.confirm;
      case 'missed': return theme.danger;
      case 'snoozed': return theme.snooze;
      default: return theme.secondary;
    }
  };

  const renderItem = ({ item }: { item: MedicationEvent }) => {
    const cfg = STATUS_CONFIG[item.status];
    const statusColor = getStatusColor(item.status);

    return (
      <View
        style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
        accessible
        accessibilityLabel={[
          item.medications?.name ?? 'Unknown medication',
          cfg.label,
          format(new Date(item.scheduled_time), 'EEEE MMMM d, h:mm a'),
          item.taken_time
            ? `taken at ${format(new Date(item.taken_time), 'h:mm a')}`
            : '',
        ]
          .filter(Boolean)
          .join(', ')}
      >
        {/* Status badge */}
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeIcon}>{cfg.icon}</Text>
        </View>

        {/* Details */}
        <View style={styles.rowDetails}>
          <Text
            style={[styles.medName, { color: theme.onSurface }]}
            numberOfLines={1}
          >
            {item.medications?.name ?? '—'}
          </Text>

          <Text style={[styles.dosage, { color: theme.secondary }]}>
            {item.medications?.dosage ?? ''}
          </Text>

          <Text style={[styles.time, { color: theme.secondary }]}>
            Scheduled: {format(new Date(item.scheduled_time), 'MMM d, h:mm a')}
          </Text>

          {item.taken_time ? (
            <Text style={[styles.time, { color: theme.confirm }]}>
              Taken: {format(new Date(item.taken_time), 'h:mm a')}
            </Text>
          ) : null}
        </View>

        {/* Status label */}
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {cfg.label}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Text
          style={[styles.backButton, { color: theme.primary }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          ← Back
        </Text>
        <Text
          style={[styles.title, { color: theme.onBackground }]}
          accessibilityRole="header"
        >
          Medication History
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text
            style={[styles.errorText, { color: theme.danger }]}
            accessibilityRole="alert"
          >
            Could not load history. Please check your connection.
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            events.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: theme.secondary }]}>
                No medication history yet.
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          accessibilityLabel="Medication history list"
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: FontSizes.patient.body,
    fontWeight: FontWeights.semibold,
    paddingVertical: 8,
    paddingRight: 16,
    minWidth: 70,
  },
  title: {
    fontSize: FontSizes.patient.heading,
    fontWeight: FontWeights.bold,
  },
  headerSpacer: {
    minWidth: 70,
  },
  list: {
    padding: 16,
  },
  listEmpty: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: FontWeights.bold,
  },
  rowDetails: {
    flex: 1,
    gap: 2,
  },
  medName: {
    fontSize: FontSizes.patient.instructions,
    fontWeight: FontWeights.bold,
  },
  dosage: {
    fontSize: FontSizes.patient.caption,
  },
  time: {
    fontSize: 14,
    marginTop: 2,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: FontWeights.semibold,
    flexShrink: 0,
  },
  emptyText: {
    fontSize: FontSizes.patient.body,
    textAlign: 'center',
  },
  errorText: {
    fontSize: FontSizes.patient.body,
    textAlign: 'center',
  },
});
