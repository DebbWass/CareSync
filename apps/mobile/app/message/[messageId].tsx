/**
 * Fullscreen urgent-message popup (M9) — the patient-side counterpart of the
 * medication reminder. Opened by the realtime subscription (app foregrounded)
 * or by tapping the push notification ({type:'message', message_id} — no PHI;
 * the body loads here, after the tap).
 *
 * Elderly a11y: one message, one huge acknowledge button, nothing else.
 * Viewing marks the message delivered; the button marks it read.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ui/ErrorBanner';
import { useMarkMessageRead, useMessageById } from '../../src/hooks/useMessages';
import { markMessageDelivered } from '../../src/services/supabase/messages';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { FontSizes } from '../../src/constants/typography';

export default function UrgentMessageScreen() {
  const { t } = useTranslation();
  const { messageId } = useLocalSearchParams<{ messageId: string }>();
  const router = useRouter();
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;
  const userId = useAuthStore((s) => s.profile?.id);

  const { data: message, isLoading, error, refetch } = useMessageById(messageId ?? null);
  const markRead = useMarkMessageRead();

  // Seeing the message = delivered (only the recipient can transition it)
  useEffect(() => {
    if (message && userId && message.sender_id !== userId && message.status === 'sent') {
      markMessageDelivered(message.id).catch(() => {
        // Non-fatal: the receipt catches up on the next read/ack write
      });
    }
  }, [message, userId]);

  const goHome = () => router.replace('/');

  const handleAcknowledge = () => {
    if (!message) return;
    markRead.mutate(message.id, { onSettled: goHome });
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // ── Error / not found ───────────────────────────────────────────────────────
  if (error || !message) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        {error ? <ErrorBanner error={error} onRetry={refetch} /> : null}
        <View style={styles.center}>
          {!error ? (
            <Text
              size={FontSizes.patient.heading}
              weight="bold"
              color={theme.onBackground}
              align="center"
              accessibilityRole="alert"
            >
              {t('messages.notFoundTitle')}
            </Text>
          ) : null}
          <Text
            size={FontSizes.patient.body}
            weight="semibold"
            color={theme.primary}
            style={styles.homeLink}
            onPress={goHome}
            accessibilityRole="button"
            accessibilityLabel={t('patient.reminder.goHomeLabel')}
          >
            {t('patient.reminder.goHome')}
          </Text>
        </View>
      </View>
    );
  }

  // ── The message ─────────────────────────────────────────────────────────────
  const senderName = message.sender?.name;

  return (
    <View style={[styles.screen, styles.content, { backgroundColor: theme.background }]}>
      <Text
        size={14}
        weight="semibold"
        color={theme.danger}
        style={styles.urgentLabel}
        accessibilityRole="header"
      >
        {t('messages.popupLabel')}
      </Text>

      <Text size={FontSizes.patient.instructions} weight="semibold" color={theme.secondary}>
        {senderName ? t('messages.fromName', { name: senderName }) : t('messages.fromCaregiver')}
      </Text>

      <View
        style={[styles.messageCard, { backgroundColor: theme.surface, borderColor: theme.danger }]}
      >
        <Text
          size={FontSizes.patient.heading}
          weight="semibold"
          color={theme.onSurface}
          align="center"
          accessibilityLabel={t('messages.bodyA11y', { body: message.body })}
        >
          {message.body}
        </Text>
      </View>

      <Button
        label={t('messages.acknowledge')}
        onPress={handleAcknowledge}
        variant="confirm"
        size="large"
        textSize={FontSizes.patient.confirmButton}
        loading={markRead.isPending}
        accessibilityLabel={t('messages.acknowledgeLabel')}
        accessibilityHint={t('messages.acknowledgeHint')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  urgentLabel: {
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  messageCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 3,
    padding: 28,
    alignItems: 'center',
  },
  homeLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
});
