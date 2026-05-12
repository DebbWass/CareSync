/**
 * Edit/deactivate medication screen.
 * Receives id + patientId + patientName from route params.
 */
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useDeactivateMedication,
  useMedication,
  useUpdateMedication,
} from '../../../src/hooks/useMedications';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';

export default function EditMedicationScreen() {
  const router = useRouter();
  const { id, patientId, patientName } = useLocalSearchParams<{
    id: string;
    patientId: string;
    patientName: string;
  }>();

  const { data: medication, isLoading } = useMedication(id);
  const updateMutation = useUpdateMedication(patientId ?? '');
  const deactivateMutation = useDeactivateMedication(patientId ?? '');

  // Track only what the user has edited; fall back to server values for display
  const [edits, setEdits] = useState<{
    name?: string;
    dosage?: string;
    instructions?: string;
  }>({});
  const [error, setError] = useState('');

  const name = edits.name ?? medication?.name ?? '';
  const dosage = edits.dosage ?? medication?.dosage ?? '';
  const instructions = edits.instructions ?? medication?.instructions ?? '';
  const isDirty = Object.keys(edits).length > 0;

  const handleSave = () => {
    if (!name.trim()) { setError('Medication name is required.'); return; }
    if (!dosage.trim()) { setError('Dosage is required.'); return; }
    if (!id) return;

    setError('');
    updateMutation.mutate(
      {
        id,
        input: {
          name: name.trim(),
          dosage: dosage.trim(),
          instructions: instructions.trim() || undefined,
        },
      },
      {
        onSuccess: () => router.back(),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to update medication.';
          setError(msg);
        },
      }
    );
  };

  const handleDeactivate = () => {
    if (!id) return;
    Alert.alert(
      'Remove Medication',
      `Remove "${medication?.name}" from the active medication list? This cannot be undone, but all history is preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deactivateMutation.mutate(id, {
              onSuccess: () => router.back(),
              onError: (err: unknown) => {
                const msg = err instanceof Error ? err.message : 'Failed to remove medication.';
                setError(msg);
              },
            });
          },
        },
      ]
    );
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!medication) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Medication not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          <Text style={styles.title}>Edit Medication</Text>
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
            onChangeText={(v) => setEdits((e) => ({ ...e, name: v }))}
            autoCapitalize="words"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Medication name"
          />

          <TextInput
            label="Dosage *"
            value={dosage}
            onChangeText={(v) => setEdits((e) => ({ ...e, dosage: v }))}
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Dosage"
          />

          <TextInput
            label="Instructions (optional)"
            value={instructions}
            onChangeText={(v) => setEdits((e) => ({ ...e, instructions: v }))}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            accessibilityLabel="Instructions, optional"
          />

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSave}
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending || deactivateMutation.isPending || !isDirty}
            style={styles.saveButton}
            contentStyle={styles.buttonContent}
            accessibilityLabel="Save changes"
          >
            Save Changes
          </Button>

          <Button
            mode="outlined"
            onPress={() =>
              router.push({
                pathname: '/(caregiver)/schedules',
                params: { patientId, patientName },
              })
            }
            style={styles.schedulesButton}
            contentStyle={styles.buttonContent}
            accessibilityLabel="Manage schedules for this medication"
          >
            📅 Manage Schedules
          </Button>

          <Button
            mode="outlined"
            onPress={handleDeactivate}
            loading={deactivateMutation.isPending}
            disabled={updateMutation.isPending || deactivateMutation.isPending}
            style={styles.deactivateButton}
            contentStyle={styles.buttonContent}
            textColor={Colors.light.danger}
            accessibilityLabel="Remove this medication"
            accessibilityHint="Removes the medication from the active list. History is preserved."
          >
            Remove Medication
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: Colors.light.background,
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
  backLink: {
    color: Colors.light.primary,
    fontSize: FontSizes.caregiver.body,
    fontWeight: FontWeights.semibold,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  schedulesButton: {
    borderRadius: 8,
    borderColor: Colors.light.primary,
  },
  deactivateButton: {
    borderRadius: 8,
    borderColor: Colors.light.danger,
  },
  buttonContent: {
    height: 52,
  },
});
