/**
 * Patient medication history screen.
 * Shows taken/missed/snoozed events, newest first.
 */
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDateAtTime, formatLongDateTime, formatTime } from '../../src/utils/dateFormat';
import { Text } from '../../src/components/ui/Text';
import { ErrorBanner } from '../../src/components/ui/ErrorBanner';
import { useEventHistory } from '../../src/hooks/useMedicationEvent';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Colors } from '../../src/constants/colors';
import { FontSizes } from '../../src/constants/typography';
import type { EventStatus, MedicationEvent } from '../../src/types';

// ── Status badge config ────────────────────────────────────────────────────────
// Icons pair with the localized label — color is never the only indicator.

const STATUS_ICONS: Record<EventStatus, string> = {
  taken: '✓',
  missed: '✗',
  snoozed: '⏱',
  pending: '…',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PatientHistory() {
  const { t } = useTranslation();
  const router = useRouter();
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;
  const { data: events = [], isLoading, error, refetch } = useEventHistory();

  const getStatusColor = (status: EventStatus) => {
    switch (status) {
      case 'taken':
        return theme.confirm;
      case 'missed':
        return theme.danger;
      case 'snoozed':
        return theme.snooze;
      default:
        return theme.secondary;
    }
  };

  const renderItem = ({ item }: { item: MedicationEvent }) => {
    // Enum-keyed lookup so Hebrew (M6) is translation-only
    const statusLabel = t(`patient.history.status.${item.status}`);
    const statusColor = getStatusColor(item.status);

    return (
      <View
        style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
        accessible
        accessibilityLabel={[
          item.medications?.name ?? t('patient.reminder.unknownMedication'),
          statusLabel,
          formatLongDateTime(item.scheduled_time),
          item.taken_time
            ? t('patient.history.takenAtA11y', {
                time: formatTime(item.taken_time),
              })
            : '',
        ]
          .filter(Boolean)
          .join(', ')}
      >
        {/* Status badge */}
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text size={20} weight="bold" color={theme.background}>
            {STATUS_ICONS[item.status]}
          </Text>
        </View>

        {/* Details */}
        <View style={styles.rowDetails}>
          <Text
            size={FontSizes.patient.instructions}
            weight="bold"
            color={theme.onSurface}
            numberOfLines={1}
          >
            {item.medications?.name ?? '—'}
          </Text>

          <Text size={FontSizes.patient.caption} color={theme.secondary}>
            {item.medications?.dosage ?? ''}
          </Text>

          <Text size={14} color={theme.secondary} style={styles.time}>
            {t('patient.history.scheduledAt', {
              time: formatDateAtTime(item.scheduled_time),
            })}
          </Text>

          {item.taken_time ? (
            <Text size={14} color={theme.confirm} style={styles.time}>
              {t('patient.history.takenAt', {
                time: formatTime(item.taken_time),
              })}
            </Text>
          ) : null}
        </View>

        {/* Status label */}
        <Text size={14} weight="semibold" color={statusColor} style={styles.statusLabel}>
          {statusLabel}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.background, borderBottomColor: theme.border },
        ]}
      >
        <Text
          size={FontSizes.patient.body}
          weight="semibold"
          color={theme.primary}
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.backLabel')}
        >
          {t('common.back')}
        </Text>
        <Text
          size={FontSizes.patient.heading}
          weight="bold"
          color={theme.onBackground}
          accessibilityRole="header"
        >
          {t('patient.history.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error ? (
        <ErrorBanner error={error} onRetry={refetch} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, events.length === 0 && styles.listEmpty]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text size={FontSizes.patient.body} color={theme.secondary} align="center">
                {t('patient.history.empty')}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          accessibilityLabel={t('patient.history.listLabel')}
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
    paddingVertical: 8,
    paddingEnd: 16,
    minWidth: 70,
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
  rowDetails: {
    flex: 1,
    gap: 2,
  },
  time: {
    marginTop: 2,
  },
  statusLabel: {
    flexShrink: 0,
  },
  separator: {
    height: 10,
  },
});
