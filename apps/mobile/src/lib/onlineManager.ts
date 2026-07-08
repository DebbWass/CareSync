/**
 * Bridge NetInfo → TanStack Query's onlineManager (M11).
 *
 * Without this, React Query assumes it is always online and will fire queries
 * into a dead network, surfacing spurious error states while the patient is
 * simply in a lift or a dead spot. Wired to NetInfo, queries pause while
 * offline and resume (and paused mutations resume) the moment connectivity
 * returns — the app goes quiet instead of thrashing.
 *
 * Call once at startup, before the first query runs.
 */
import { onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    })
  );
}
