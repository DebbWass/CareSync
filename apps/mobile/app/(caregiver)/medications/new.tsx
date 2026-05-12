/**
 * Add medication form.
 * Receives patientId + patientName from route params.
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateMedication } from '../../../src/hooks/useMedications';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';

export default function NewMedicationScreen() {
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
  }>();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');

  const createMutation = useCreateMedication();

  const handleSave = async () => {
    if (!name.trim()) { setError('Medication name is required.'); return; }
    if (!dosage.trim()) { setError('Dosage is required (e.g. "10mg" or "2 tablets").'); return; }
    if (!patientId) { setError('No patient selected.'); return; }

    setError('');
    createMutation.mutate(
      {
        patient_id: patientId,
        name: name.trim(),
        dosage: dosage.trim(),
        instructions: instructions.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to save medication.';
          setError(msg);
        },
      }
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cancel and go back"
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Add Medication</Text>
          {patientName ? (
            <Text style={styles.subtitle} numberOfLines={1}>for {patientName}</Text>
          ) : null}
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            label="Medication Name *"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Medication name, required"
            placeholder="e.g. Metformin"
          />

          <TextInput
            label="Dosage *"
            value={dosage}
            onChangeText={setDosage}
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Dosage, required"
            placeholder="e.g. 500mg — 1 tablet"
          />

          <TextInput
            label="Instructions (optional)"
            value={instructions}
            onChangeText={setInstructions}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            accessibilityLabel="Instructions, optional"
            placeholder="e.g. Take with food and water"
          />

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSave}
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
            accessibilityLabel="Save medication"
          >
            Save Medication
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerBtn: {
    minWidth: 70,
    paddingVertical: 6,
  },
  headerBtnText: {
    fontSize: FontSizes.caregiver.body,
    color: '#FFFFFF',
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
  form: {
    padding: 20,
    gap: 14,
  },
  input: {
    backgroundColor: Colors.light.background,
  },
  errorText: {
    color: Colors.light.danger,
    fontSize: FontSizes.caregiver.body,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  saveButtonContent: {
    height: 52,
  },
});
