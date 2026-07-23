/**
 * Caregiver alert inbox.
 * Shows all alerts (missed dose, snooze limit reached), with mark-as-read.
 */
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { formatDateAtTime, formatShortDate } from '../../src/utils/dateFormat';
import { useTranslation } from 'react-i18next';
import { useAlerts, useMarkAlertRead, useMarkAllAlertsRead } from '../../src/hooks/useAlerts';
import { ErrorBanner } from '../../src/components/ui/ErrorBanner';
import { Colors } from '../../src/constants/colors';
import { FontSizes, FontWeights } from '../../src/constants/typography';
import type { Alert, AlertType } from '../../src/types';

// ── Alert type config (labels resolved via i18n at render time) ───────────────

const ALERT_CONFIG: Record<AlertType, { icon: string; color: string }> = {
  missed: { icon: '⚠', color: Colors.light.danger },
  snoozed_limit: { icon: '⏱', color: Colors.light.snooze },
  low_adherence: { icon: '📉', color: Colors.light.snooze },
  new_medication: { icon: '💊', color: Colors.light.primary },
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const { t } = useTranslation();
  const { data: alerts = [], isLoading, error, refetch } = useAlerts();
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <View style={styles.screen}>
      {/* Header — back button removed (hardware/gesture back handles it); the
          leading spacer keeps the title centered against the trailing button. */}
      <View style={styles.header}>
        <View style={styles.headerBtn} />
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('alerts.title')}</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>{t('alerts.unreadCount', { count: unreadCount })}</Text>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => markAllRead.mutate()}
            style={styles.headerBtn}
            disabled={markAllRead.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('alerts.readAllLabel')}
          >
            <Text style={styles.markAllText}>
              {markAllRead.isPending ? '...' : t('alerts.readAll')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : error ? (
        <ErrorBanner error={error} onRetry={refetch} />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AlertRow
              alert={item}
              onMarkRead={() => markRead.mutate(item.id)}
              isMarkingRead={markRead.isPending && markRead.variables === item.id}
            />
          )}
          contentContainerStyle={[styles.list, alerts.length === 0 && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyTitle}>{t('alerts.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('alerts.emptyBody')}</Text>
            </View>
          }
          accessibilityLabel={t('alerts.listLabel')}
        />
      )}
    </View>
  );
}

// ── AlertRow ──────────────────────────────────────────────────────────────────

interface AlertRowProps {
  alert: Alert;
  onMarkRead: () => void;
  isMarkingRead: boolean;
}

function AlertRow({ alert, onMarkRead, isMarkingRead }: AlertRowProps) {
  const { t } = useTranslation();
  const cfg = ALERT_CONFIG[alert.alert_type];
  const typeLabel = t(`alerts.type.${alert.alert_type}`);
  const patientName =
    (alert as Alert & { patient?: { name: string } }).patient?.name ??
    t('alerts.defaultPatientName');
  const scheduledTime = alert.medication_events?.scheduled_time;

  return (
    <View
      style={[styles.row, !alert.is_read && styles.rowUnread]}
      accessible
      accessibilityLabel={[
        alert.is_read ? '' : t('alerts.unreadPrefix'),
        typeLabel,
        t('alerts.forPatient', { name: patientName }),
        scheduledTime
          ? t('alerts.scheduledA11y', {
              time: formatDateAtTime(scheduledTime),
            })
          : '',
        formatShortDate(alert.created_at),
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {/* Type icon */}
      <View style={[styles.iconBadge, { backgroundColor: cfg.color }]}>
        <Text style={styles.iconText}>{cfg.icon}</Text>
      </View>

      {/* Details */}
      <View style={styles.rowDetails}>
        <Text style={styles.alertLabel}>{typeLabel}</Text>
        <Text style={styles.patientName}>{patientName}</Text>
        {scheduledTime ? (
          <Text style={styles.time}>
            {t('alerts.scheduledAt', {
              time: formatDateAtTime(scheduledTime),
            })}
          </Text>
        ) : null}
        <Text style={styles.createdAt}>{formatDateAtTime(alert.created_at)}</Text>
      </View>

      {/* Unread dot / mark read */}
      <View style={styles.rowRight}>
        {!alert.is_read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
        {!alert.is_read && (
          <TouchableOpacity
            onPress={onMarkRead}
            disabled={isMarkingRead}
            style={styles.readBtn}
            accessibilityRole="button"
            accessibilityLabel={t('alerts.markRead')}
          >
            {isMarkingRead ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : (
              <Text style={styles.readBtnText}>✓</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  },
  headerBtn: { minWidth: 70, paddingVertical: 6 },
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
  markAllText: {
    fontSize: FontSizes.caregiver.label,
    color: '#FFFFFF',
    fontWeight: FontWeights.semibold,
    textAlign: 'right',
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 12,
  },
  rowUnread: {
    backgroundColor: '#FFFBF0',
    borderColor: Colors.light.snooze,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 20, color: '#FFFFFF' },
  rowDetails: { flex: 1, gap: 3 },
  alertLabel: {
    fontSize: FontSizes.caregiver.body,
    fontWeight: FontWeights.bold,
    color: Colors.light.onBackground,
  },
  patientName: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.primary,
    fontWeight: FontWeights.medium,
  },
  time: { fontSize: FontSizes.caregiver.label, color: Colors.light.secondary },
  createdAt: { fontSize: FontSizes.caregiver.label, color: Colors.light.secondary },
  rowRight: { alignItems: 'center', gap: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5 },
  readBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readBtnText: {
    color: Colors.light.confirm,
    fontSize: 16,
    fontWeight: FontWeights.bold,
  },
  emptyIcon: {
    fontSize: 56,
    color: Colors.light.confirm,
  },
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
