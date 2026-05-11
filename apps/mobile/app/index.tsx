import { ActivityIndicator, View, StyleSheet } from 'react-native';

// Initial route — AuthGuard in _layout.tsx redirects immediately once the
// navigator mounts. This screen is a placeholder so Expo Router has a
// valid route at "/" on cold start.
export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
