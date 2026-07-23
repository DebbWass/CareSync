/**
 * Caregiver↔patient message thread (M9): history, compose, receipts.
 * Route params: patientId, patientName
 *
 * Receipts show under the caregiver's own messages (sent → delivered → read),
 * always icon + text — never color alone. Opening the thread marks incoming
 * messages read; realtime keeps the thread live while it is open.
 */
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ErrorBanner } from '../../../src/components/ui/ErrorBanner';
import { useMarkThreadRead, useSendMessage, useThread } from '../../../src/hooks/useMessages';
import { useAuthStore } from '../../../src/store/authStore';
import { useOutboxStore } from '../../../src/store/outboxStore';
import { formatDateAtTime } from '../../../src/utils/dateFormat';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';
import type { Message, MessageStatus } from '../../../src/types';

const MAX_MESSAGE_LENGTH = 2000;

// Receipt = icon + label, resolved via i18n at render time (never color-only)
const RECEIPT_ICONS: Record<MessageStatus, string> = {
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
};

export default function MessageThreadScreen() {
  const { t } = useTranslation();
  const { patientId = '', patientName = '' } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
  }>();
  const caregiverId = useAuthStore((s) => s.profile?.id) ?? '';

  const { data: messages = [], isLoading, error, refetch } = useThread(patientId, caregiverId);
  const send = useSendMessage();
  const markThreadRead = useMarkThreadRead();
  const hasQueued = useOutboxStore((s) => s.entries.length > 0);

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  // Opening (and receiving into) the thread marks incoming messages read
  const unreadIncoming = messages.some((m) => m.sender_id !== caregiverId && m.status !== 'read');
  useEffect(() => {
    if (unreadIncoming && patientId && caregiverId) {
      markThreadRead.mutate({ patientId, caregiverId });
    }
    // markThreadRead identity changes per render; keying on the data is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIncoming, patientId, caregiverId]);

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    send.mutate({ patient_id: patientId, caregiver_id: caregiverId, body });
  };

  const renderItem = ({ item }: { item: Message }) => {
    const mine = item.sender_id === caregiverId;
    const receiptLabel = t(`messages.receipts.${item.status}`);
    const queued = item.id.startsWith('outbox-');

    return (
      <View
        style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
        accessible
        accessibilityLabel={
          mine
            ? t('messages.bubbleMineA11y', { body: item.body, receipt: receiptLabel })
            : t('messages.bubbleTheirsA11y', { name: patientName, body: item.body })
        }
      >
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
          <Text style={[styles.bubbleMeta, mine && styles.bubbleMetaMine]}>
            {formatDateAtTime(item.created_at)}
            {mine
              ? ` · ${queued ? t('messages.queuedOffline') : `${RECEIPT_ICONS[item.status]} ${receiptLabel}`}`
              : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('messages.threadWith', { name: patientName || t('alerts.defaultPatientName') })}
        </Text>
      </View>

      {hasQueued ? (
        <Text style={styles.queuedBanner} accessibilityRole="alert">
          {t('messages.outboxPending')}
        </Text>
      ) : null}

      {/* Thread */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : error ? (
        <ErrorBanner error={error} onRetry={refetch} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('messages.empty')}</Text>
            </View>
          }
          accessibilityLabel={t('messages.listA11y')}
        />
      )}

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('messages.placeholder')}
          mode="outlined"
          style={styles.input}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          accessibilityLabel={t('messages.placeholderA11y')}
        />
        <TouchableOpacity
          style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || send.isPending}
          accessibilityRole="button"
          accessibilityLabel={t('messages.sendA11y')}
          accessibilityState={{ disabled: !draft.trim() || send.isPending }}
        >
          <Text style={styles.sendButtonText}>{t('messages.send')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: FontSizes.caregiver.title,
    fontWeight: FontWeights.bold,
    color: Colors.light.onBackground,
  },
  queuedBanner: {
    fontSize: FontSizes.caregiver.label,
    color: Colors.light.snooze,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
    paddingVertical: 6,
  },
  list: {
    padding: 16,
    gap: 8,
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
  emptyText: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.secondary,
    textAlign: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleMine: {
    backgroundColor: Colors.light.primary,
  },
  bubbleTheirs: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  bubbleText: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.onSurface,
    lineHeight: FontSizes.caregiver.body * 1.4,
  },
  bubbleTextMine: {
    color: Colors.light.onPrimary,
  },
  bubbleMeta: {
    fontSize: FontSizes.caregiver.caption,
    color: Colors.light.secondary,
  },
  bubbleMetaMine: {
    color: Colors.light.onPrimary,
    opacity: 0.85,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: Colors.light.background,
  },
  sendButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    minHeight: 48,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: Colors.light.onPrimary,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.caregiver.body,
  },
});
