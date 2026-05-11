import { View, StyleSheet } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { Colors } from '../../../src/constants/colors';

// Medication management list — full implementation in Phase 4.
export default function MedicationsScreen() {
  return (
    <View style={styles.container}>
      <Text size={32} weight="bold" color={Colors.light.primary}>
        Medications
      </Text>
      <View style={styles.placeholder}>
        <Text size={40} align="center">💊</Text>
        <Text size={16} color={Colors.light.secondary} align="center">
          Medication management coming in Phase 4
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingTop: 64,
    gap: 8,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
});
