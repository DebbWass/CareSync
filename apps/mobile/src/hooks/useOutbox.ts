/**
 * Mount once in the root layout: flushes the message outbox on app start and
 * whenever connectivity returns. The store itself is subscription-free; this
 * hook owns the NetInfo lifecycle.
 */
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOutboxStore } from '../store/outboxStore';

export function useOutboxFlusher() {
  useEffect(() => {
    // App start: anything queued from a previous session
    useOutboxStore.getState().flush();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        useOutboxStore.getState().flush();
      }
    });
    return unsubscribe;
  }, []);
}
