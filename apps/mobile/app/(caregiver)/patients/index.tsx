import { useCallback, useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { Colors } from '../../../src/constants/colors';
import { useAuthStore } from '../../../src/store/authStore';
import { supabase } from '../../../src/lib/supabase';

interface LinkedPatient {
  relationshipId: string;
  patientId: string;
  status: 'pending' | 'active' | 'revoked';
  name: string;
  email: string;
}

export default function PatientsScreen() {
  const { supabaseUser } = useAuthStore();
  const [patientUuid, setPatientUuid] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patients, setPatients] = useState<LinkedPatient[]>([]);

  const loadRelationships = useCallback(async () => {
    if (!supabaseUser?.id) return;

    setLoading(true);
    try {
      const { data: relationships, error } = await supabase
        .from('patient_caregiver_relationships')
        .select('id, patient_id, status')
        .eq('caregiver_id', supabaseUser.id)
        .neq('status', 'revoked')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const patientIds = (relationships ?? []).map((item) => item.patient_id as string);
      let usersById: Record<string, { name: string; email: string }> = {};

      if (patientIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', patientIds);

        if (usersError) throw usersError;

        usersById = (users ?? []).reduce<Record<string, { name: string; email: string }>>(
          (acc, user) => {
            acc[user.id as string] = {
              name: String(user.name ?? 'Unknown patient'),
              email: String(user.email ?? ''),
            };
            return acc;
          },
          {}
        );
      }

      const mapped: LinkedPatient[] = (relationships ?? []).map((item) => ({
        relationshipId: item.id as string,
        patientId: item.patient_id as string,
        status: item.status as 'pending' | 'active' | 'revoked',
        name: usersById[item.patient_id as string]?.name ?? 'Unknown patient',
        email: usersById[item.patient_id as string]?.email ?? '',
      }));

      setPatients(mapped);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not load patients.';
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [supabaseUser?.id]);

  useFocusEffect(
    useCallback(() => {
      loadRelationships();
    }, [loadRelationships])
  );

  async function handleLinkPatient() {
    if (!supabaseUser?.id) return;

    const trimmed = patientUuid.trim();
    if (!trimmed) {
      Alert.alert('Missing patient ID', 'Paste the patient UUID to create a relationship.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('patient_caregiver_relationships').insert({
        patient_id: trimmed,
        caregiver_id: supabaseUser.id,
      });

      if (error) throw error;

      setPatientUuid('');
      await loadRelationships();
      Alert.alert('Request sent', 'Patient relationship was created as pending.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not link patient.';
      Alert.alert('Link failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateRelationshipStatus(relationshipId: string, status: 'active' | 'revoked') {
    try {
      const { error } = await supabase
        .from('patient_caregiver_relationships')
        .update({ status })
        .eq('id', relationshipId);

      if (error) throw error;
      await loadRelationships();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not update relationship.';
      Alert.alert('Update failed', message);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadRelationships} />
      }
    >
      <Text size={30} weight="bold" color={Colors.light.primary}>
        Patients
      </Text>
      <Text size={14} color={Colors.light.secondary}>
        Link a patient by their UUID, then activate/revoke access.
      </Text>

      <View style={styles.card}>
        <Text size={16} weight="semibold">Link Patient</Text>
        <TextInput
          mode="outlined"
          label="Patient UUID"
          value={patientUuid}
          onChangeText={setPatientUuid}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Patient UUID"
        />
        <Button
          label="Send Link Request"
          onPress={handleLinkPatient}
          loading={submitting}
          accessibilityLabel="Create caregiver-patient relationship"
        />
      </View>

      <View style={styles.listSection}>
        <Text size={18} weight="semibold">Linked Patients</Text>
        {patients.length === 0 ? (
          <View style={styles.emptyState}>
            <Text size={15} color={Colors.light.secondary} align="center">
              No linked patients yet.
            </Text>
          </View>
        ) : (
          patients.map((patient) => (
            <View key={patient.relationshipId} style={styles.patientCard}>
              <Text size={17} weight="bold">{patient.name}</Text>
              <Text size={13} color={Colors.light.secondary}>{patient.email || patient.patientId}</Text>
              <Text size={13} color={patient.status === 'active' ? Colors.light.confirm : Colors.light.snooze}>
                Status: {patient.status}
              </Text>

              <View style={styles.rowButtons}>
                {patient.status !== 'active' ? (
                  <TouchableOpacity
                    style={[styles.smallButton, styles.activateButton]}
                    onPress={() => updateRelationshipStatus(patient.relationshipId, 'active')}
                  >
                    <Text size={13} color={Colors.light.onConfirm} align="center">Activate</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.smallButton, styles.revokeButton]}
                  onPress={() => updateRelationshipStatus(patient.relationshipId, 'revoked')}
                >
                  <Text size={13} color={Colors.light.onDanger} align="center">Revoke</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 12,
  },
  input: {
    backgroundColor: Colors.light.background,
  },
  listSection: {
    marginTop: 8,
    gap: 10,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  patientCard: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.light.surface,
    gap: 6,
  },
  rowButtons: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  activateButton: {
    backgroundColor: Colors.light.confirm,
  },
  revokeButton: {
    backgroundColor: Colors.light.danger,
  },
});
