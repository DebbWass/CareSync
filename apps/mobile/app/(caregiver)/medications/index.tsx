import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { Colors } from '../../../src/constants/colors';
import { useAuthStore } from '../../../src/store/authStore';
import { supabase } from '../../../src/lib/supabase';

interface ActivePatient {
  patientId: string;
  name: string;
}

interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
}

export default function MedicationsScreen() {
  const { supabaseUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patients, setPatients] = useState<ActivePatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [medications, setMedications] = useState<MedicationItem[]>([]);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');

  const selectedPatientName = useMemo(
    () => patients.find((patient) => patient.patientId === selectedPatientId)?.name ?? 'Unknown patient',
    [patients, selectedPatientId]
  );

  const loadPatients = useCallback(async () => {
    if (!supabaseUser?.id) return;

    const { data: relationships, error } = await supabase
      .from('patient_caregiver_relationships')
      .select('patient_id')
      .eq('caregiver_id', supabaseUser.id)
      .eq('status', 'active');

    if (error) throw error;

    const patientIds = (relationships ?? []).map((row) => row.patient_id as string);
    if (patientIds.length === 0) {
      setPatients([]);
      setSelectedPatientId(null);
      return;
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', patientIds);

    if (usersError) throw usersError;

    const activePatients = (users ?? []).map((user) => ({
      patientId: user.id as string,
      name: String(user.name ?? 'Patient'),
    }));

    setPatients(activePatients);
    setSelectedPatientId((prev) => prev ?? activePatients[0]?.patientId ?? null);
  }, [supabaseUser?.id]);

  const loadMedications = useCallback(async (patientId: string | null) => {
    if (!patientId) {
      setMedications([]);
      return;
    }

    const { data, error } = await supabase
      .from('medications')
      .select('id, name, dosage, instructions')
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setMedications(
      (data ?? []).map((item) => ({
        id: item.id as string,
        name: String(item.name ?? ''),
        dosage: String(item.dosage ?? ''),
        instructions: String(item.instructions ?? ''),
      }))
    );
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadPatients();
      await loadMedications(selectedPatientId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not load medications.';
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [loadMedications, loadPatients, selectedPatientId]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  async function handleCreateMedication() {
    if (!supabaseUser?.id) return;
    if (!selectedPatientId) {
      Alert.alert('No patient selected', 'Please link and choose an active patient first.');
      return;
    }

    if (!name.trim() || !dosage.trim()) {
      Alert.alert('Missing fields', 'Medication name and dosage are required.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('medications').insert({
        patient_id: selectedPatientId,
        created_by: supabaseUser.id,
        name: name.trim(),
        dosage: dosage.trim(),
        instructions: instructions.trim() || null,
      });

      if (error) throw error;

      setName('');
      setDosage('');
      setInstructions('');
      await loadMedications(selectedPatientId);
      Alert.alert('Added', 'Medication created successfully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not create medication.';
      Alert.alert('Create failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivateMedication(medicationId: string) {
    try {
      const { error } = await supabase
        .from('medications')
        .update({ is_active: false })
        .eq('id', medicationId);

      if (error) throw error;
      await loadMedications(selectedPatientId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not deactivate medication.';
      Alert.alert('Update failed', message);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} />}
    >
      <Text size={30} weight="bold" color={Colors.light.primary}>
        Medications
      </Text>

      <View style={styles.card}>
        <Text size={16} weight="semibold">Choose Patient</Text>
        {patients.length === 0 ? (
          <Text size={14} color={Colors.light.secondary}>
            No active patients found. Go to Patients tab to link and activate one.
          </Text>
        ) : (
          <View style={styles.patientList}>
            {patients.map((patient) => {
              const selected = patient.patientId === selectedPatientId;
              return (
                <TouchableOpacity
                  key={patient.patientId}
                  style={[styles.patientChip, selected && styles.patientChipSelected]}
                  onPress={() => {
                    setSelectedPatientId(patient.patientId);
                    loadMedications(patient.patientId).catch(() => {});
                  }}
                >
                  <Text size={13} color={selected ? Colors.light.onPrimary : Colors.light.primary}>
                    {patient.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text size={16} weight="semibold">Add Medication</Text>
        <TextInput
          mode="outlined"
          label="Medication Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Dosage"
          value={dosage}
          onChangeText={setDosage}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Instructions (optional)"
          value={instructions}
          onChangeText={setInstructions}
          style={styles.input}
          multiline
        />
        <Button
          label={selectedPatientId ? `Add for ${selectedPatientName}` : 'Add Medication'}
          onPress={handleCreateMedication}
          loading={submitting}
          disabled={!selectedPatientId}
        />
      </View>

      <View style={styles.listSection}>
        <Text size={18} weight="semibold">Active Medications</Text>
        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text size={14} color={Colors.light.secondary} align="center">
              No active medications for the selected patient.
            </Text>
          </View>
        ) : (
          medications.map((medication) => (
            <View key={medication.id} style={styles.medCard}>
              <Text size={17} weight="bold">{medication.name}</Text>
              <Text size={14} color={Colors.light.secondary}>{medication.dosage}</Text>
              {medication.instructions ? (
                <Text size={13} color={Colors.light.secondary}>{medication.instructions}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.deactivateButton}
                onPress={() => handleDeactivateMedication(medication.id)}
              >
                <Text size={13} color={Colors.light.onDanger} align="center">Deactivate</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    padding: 12,
    gap: 10,
  },
  input: {
    backgroundColor: Colors.light.background,
  },
  patientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  patientChip: {
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.background,
  },
  patientChipSelected: {
    backgroundColor: Colors.light.primary,
  },
  listSection: {
    gap: 10,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  medCard: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    padding: 12,
    gap: 6,
  },
  deactivateButton: {
    marginTop: 4,
    backgroundColor: Colors.light.danger,
    borderRadius: 8,
    paddingVertical: 10,
  },
});
