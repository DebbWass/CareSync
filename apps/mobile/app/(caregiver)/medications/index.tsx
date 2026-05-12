/**
 * Medication list screen — shows all active medications for a patient.
 * Receives patientId + patientName from route params.
 */
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMedications } from '../../../src/hooks/useMedications';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';
import type { Medication } from '../../../src/types';

export default function MedicationListScreen() {
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
  }>();

  const { data: medications = [], isLoading, error } = useMedications(patientId);

  const handleAdd = () => {
    router.push({
      pathname: '/(caregiver)/medications/new',
      params: { patientId, patientName },
    });
  };

  const handleEdit = (med: Medication) => {
    router.push({
      pathname: '/(caregiver)/medications/[id]',
      params: { id: med.id, patientId, patientName },
    });
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>Medications</Text>
          {patientName ? (
            <Text style={styles.subtitle} numberOfLines={1}>{patientName}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel="Add medication"
          accessibilityHint="Double tap to add a new medication for this patient"
          style={styles.addBtn}
        >
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText} accessibilityRole="alert">
            Could not load medications. Please check your connection.
          </Text>
        </View>
      ) : (
        <FlatList
          data={medications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MedicationRow med={item} onPress={() => handleEdit(item)} />
          )}
          contentContainerStyle={[
            styles.list,
            medications.length === 0 && styles.listEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No medications yet</Text>
              <Text style={styles.emptyBody}>
                Tap &quot;+ Add&quot; to create the first medication for {patientName ?? 'this patient'}.
              </Text>
            </View>
          }
          accessibilityLabel="Medication list"
        />
      )}
    </View>
  );
}

// ── MedicationRow ─────────────────────────────────────────────────────────────

function MedicationRow({
  med,
  onPress,
}: {
  med: Medication;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${med.name}, ${med.dosage}${med.instructions ? `, ${med.instructions}` : ''}`}
      accessibilityHint="Double tap to edit this medication"
    >
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>💊</Text>
      </View>
      <View style={styles.rowDetails}>
        <Text style={styles.medName}>{med.name}</Text>
        <Text style={styles.medDosage}>{med.dosage}</Text>
        {med.instructions ? (
          <Text style={styles.medInstructions} numberOfLines={1}>
            {med.instructions}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  backBtn: {
    minWidth: 60,
    paddingVertical: 6,
  },
  backText: {
    fontSize: FontSizes.caregiver.body,
    color: '#FFFFFF',
    fontWeight: FontWeights.semibold,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: FontSizes.caregiver.label,
    color: '#FFFFFF',
    opacity: 0.85,
    marginTop: 2,
  },
  addBtn: {
    minWidth: 60,
    alignItems: 'flex-end',
    paddingVertical: 6,
  },
  addText: {
    fontSize: FontSizes.caregiver.body,
    color: '#FFFFFF',
    fontWeight: FontWeights.bold,
  },
  list: {
    padding: 16,
  },
  listEmpty: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowIconText: {
    fontSize: 22,
  },
  rowDetails: {
    flex: 1,
    gap: 2,
  },
  medName: {
    fontSize: FontSizes.caregiver.title,
    fontWeight: FontWeights.semibold,
    color: Colors.light.onBackground,
  },
  medDosage: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.secondary,
  },
  medInstructions: {
    fontSize: FontSizes.caregiver.label,
    color: Colors.light.secondary,
  },
  chevron: {
    fontSize: 24,
    color: Colors.light.secondary,
  },
  emptyTitle: {
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold,
    color: Colors.light.onBackground,
  },
  emptyBody: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.secondary,
    textAlign: 'center',
    lineHeight: FontSizes.caregiver.body * 1.5,
  },
  errorText: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.danger,
    textAlign: 'center',
  },
});
