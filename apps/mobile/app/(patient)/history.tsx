import { View, StyleSheet } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { Colors } from '../../src/constants/colors';

// Medication history screen — full implementation in Phase 3.
export default function PatientHistoryScreen() {
  return (
    <View style={styles.container}>
      <Text size={40} align="center">📋</Text>
      <Text size={22} weight="semibold" color={Colors.light.primary} align="center">
        Medication History
      </Text>
      <Text size={16} color={Colors.light.secondary} align="center">
        Your medication history will appear here
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
