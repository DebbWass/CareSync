/**
 * Mount once in the root layout: flushes the offline outboxes on app start and
 * whenever connectivity returns. Two queues ride the single NetInfo listener —
 * urgent messages (M9) and medication confirmations (M11). The stores are
 * subscription-free; this hook owns the NetInfo lifecycle.
 */
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOutboxStore } from '../store/outboxStore';
import { useConfirmOutboxStore } from '../store/confirmOutboxStore';

function flushAll(): void {
  useOutboxStore.getState().flush();
  useConfirmOutboxStore.getState().flush();
}

export function useOutboxFlusher() {
  useEffect(() => {
    // App start: anything queued from a previous session
    flushAll();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flushAll();
      }
    });
    return unsubscribe;
  }, []);
}
