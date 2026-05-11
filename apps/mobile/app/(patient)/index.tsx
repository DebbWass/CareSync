import { View, StyleSheet } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/store/authStore';

// Patient home screen — Phase 3 will replace this with the fullscreen reminder UI.
// For now it shows a welcome state so we can verify auth + routing works.
export default function PatientHomeScreen() {
  const { profile } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text size={48} align="center">✅</Text>
      <Text size={28} weight="bold" color={Colors.light.primary} align="center">
        All caught up!
      </Text>
      <Text size={20} color={Colors.light.secondary} align="center">
        {profile?.name ? `Welcome, ${profile.name}` : 'Welcome'}
      </Text>
      <Text size={18} color={Colors.light.secondary} align="center" style={styles.hint}>
        Medication reminders will appear here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    paddingHorizontal: 32,
    gap: 16,
  },
  hint: { marginTop: 8 },
});
