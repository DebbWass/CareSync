import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Colors } from '../../src/constants/colors';

// Deep-link target for push notification taps: caresync://reminder/[eventId]
// Full fullscreen reminder UI built in Phase 3.
export default function ReminderScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  return (
    <View style={styles.container}>
      <Text size={40} align="center">💊</Text>
      <Text size={24} weight="bold" color={Colors.light.primary} align="center">
        Medication Reminder
      </Text>
      <Text size={14} color={Colors.light.secondary} align="center">
        Event: {eventId}
      </Text>
      <Text size={16} color={Colors.light.secondary} align="center">
        Full reminder screen coming in Phase 3
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
});
