/**
 * Patient management screen — lists linked patients and lets the caregiver
 * invite new patients by email or revoke access.
 */
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useLinkedPatients, usePendingInvitations } from '../../../src/hooks/usePatients';
import { invitePatientByEmail, revokeAccess } from '../../../src/services/supabase/patients';
import { patientKeys } from '../../../src/hooks/usePatients';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';
import type { PatientCaregiverRelationship, User } from '../../../src/types';

export default function PatientManagementScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const caregiverId = useAuthStore((s) => s.profile?.id ?? '');

  const { data: patients = [], isLoading: patientsLoading } = useLinkedPatients();
  const { data: pending = [], isLoading: pendingLoading } = usePendingInvitations();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { setInviteError('Enter an email address.'); return; }
    setInviteError('');
    setInviteSuccess('');
    setInviteLoading(true);
    try {
      await invitePatientByEmail(caregiverId, inviteEmail);
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
      qc.invalidateQueries({ queryKey: patientKeys.pending(caregiverId) });
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRevoke = (rel: PatientCaregiverRelationship & { patient: User }) => {
    Alert.alert(
      'Remove Patient',
      `Remove ${rel.patient.name} from your patients? You will no longer receive alerts for them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeAccess(rel.id);
              qc.invalidateQueries({ queryKey: patientKeys.linked(caregiverId) });
            } catch (e) {
              console.error('Revoke error:', e);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.headerBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Patients</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {/* Invite form */}
              <Text style={styles.sectionTitle}>Invite a Patient</Text>
              <Text style={styles.sectionSubtitle}>
                Enter the email address of the patient&apos;s CareSync account.
              </Text>
              <View style={styles.inviteRow}>
                <TextInput
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  label="Patient email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  mode="outlined"
                  style={styles.inviteInput}
                  accessibilityLabel="Patient email address"
                />
                <Button
                  mode="contained"
                  onPress={handleInvite}
                  loading={inviteLoading}
                  disabled={inviteLoading}
                  style={styles.inviteButton}
                  accessibilityLabel="Send invitation"
                >
                  Invite
                </Button>
              </View>
              {inviteError ? (
                <Text style={styles.errorText} accessibilityRole="alert">
                  {inviteError}
                </Text>
              ) : null}
              {inviteSuccess ? (
                <Text style={styles.successText} accessibilityLiveRegion="polite">
                  {inviteSuccess}
                </Text>
              ) : null}

              {/* Pending invitations */}
              {pendingLoading ? null : pending.length > 0 ? (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                    Pending Invitations
                  </Text>
                  {pending.map((rel) => (
                    <View key={rel.id} style={styles.pendingRow}>
                      <Text style={styles.pendingName}>
                        {(rel as PatientCaregiverRelationship & { patient?: { name?: string } }).patient?.name ?? 'Awaiting acceptance'}
                      </Text>
                      <Text style={styles.pendingStatus}>⏳ Pending</Text>
                    </View>
                  ))}
                </>
              ) : null}

              {/* Active patients header */}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                Active Patients ({patients.length})
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PatientRow
              rel={item as PatientCaregiverRelationship & { patient: User }}
              onRevoke={() =>
                handleRevoke(item as PatientCaregiverRelationship & { patient: User })
              }
              onViewMedications={() =>
                router.push({
                  pathname: '/(caregiver)/medications',
                  params: {
                    patientId: (item as PatientCaregiverRelationship & { patient: User }).patient.id,
                    patientName: (item as PatientCaregiverRelationship & { patient: User }).patient.name,
                  },
                })
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            !patientsLoading ? (
              <Text style={styles.emptyText}>
                No active patients yet. Send an invitation above.
              </Text>
            ) : null
          }
          ListFooterComponent={
            patientsLoading ? (
              <ActivityIndicator
                size="large"
                color={Colors.light.primary}
                style={{ marginTop: 24 }}
              />
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </View>
  );
}

// ── PatientRow ────────────────────────────────────────────────────────────────

interface PatientRowProps {
  rel: PatientCaregiverRelationship & { patient: User };
  onRevoke: () => void;
  onViewMedications: () => void;
}

function PatientRow({ rel, onRevoke, onViewMedications }: PatientRowProps) {
  return (
    <View style={styles.patientRow}>
      <View style={styles.patientAvatar}>
        <Text style={styles.patientAvatarText}>
          {rel.patient.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>{rel.patient.name}</Text>
        <Text style={styles.patientEmail}>{rel.patient.email}</Text>
      </View>
      <View style={styles.patientActions}>
        <TouchableOpacity
          onPress={onViewMedications}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={`View medications for ${rel.patient.name}`}
        >
          <Text style={styles.actionBtnText}>💊</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRevoke}
          style={[styles.actionBtn, styles.revokeBtn]}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${rel.patient.name}`}
        >
          <Text style={styles.revokeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
  },
  headerBtn: { minWidth: 70, paddingVertical: 6 },
  headerBtnText: {
    fontSize: FontSizes.caregiver.body, color: '#FFFFFF', fontWeight: FontWeights.semibold,
  },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold, color: '#FFFFFF',
  },
  list: { padding: 16, paddingBottom: 40 },
  listHeader: { marginBottom: 8 },
  sectionTitle: {
    fontSize: FontSizes.caregiver.title,
    fontWeight: FontWeights.bold, color: Colors.light.onBackground, marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FontSizes.caregiver.label, color: Colors.light.secondary, marginBottom: 10,
  },
  inviteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  inviteInput: { flex: 1, backgroundColor: Colors.light.background },
  inviteButton: { marginTop: 6 },
  errorText: { color: Colors.light.danger, fontSize: FontSizes.caregiver.label, marginTop: 4 },
  successText: { color: Colors.light.confirm, fontSize: FontSizes.caregiver.label, marginTop: 4 },
  pendingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.light.surface, borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: Colors.light.border, marginTop: 6,
  },
  pendingName: { fontSize: FontSizes.caregiver.body, color: Colors.light.onBackground },
  pendingStatus: { fontSize: FontSizes.caregiver.label, color: Colors.light.secondary },
  patientRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.light.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.light.border, gap: 12,
  },
  patientAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center',
  },
  patientAvatarText: { fontSize: 20, fontWeight: FontWeights.bold, color: '#FFFFFF' },
  patientInfo: { flex: 1, gap: 2 },
  patientName: {
    fontSize: FontSizes.caregiver.title,
    fontWeight: FontWeights.semibold, color: Colors.light.onBackground,
  },
  patientEmail: { fontSize: FontSizes.caregiver.label, color: Colors.light.secondary },
  patientActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.light.border, alignItems: 'center', justifyContent: 'center',
  },
  revokeBtn: { backgroundColor: '#FFEBEE' },
  actionBtnText: { fontSize: 18 },
  revokeBtnText: { fontSize: 16, color: Colors.light.danger, fontWeight: FontWeights.bold },
  emptyText: {
    fontSize: FontSizes.caregiver.body, color: Colors.light.secondary, textAlign: 'center',
    marginTop: 16,
  },
});
