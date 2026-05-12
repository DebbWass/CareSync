/**
 * Caregiver dashboard — shows linked patients, medication counts, and alert badge.
 * Serves as the navigation hub for the caregiver side of the app.
 */
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useLinkedPatients } from '../../src/hooks/usePatients';
import { useUnreadAlertCount } from '../../src/hooks/useAlerts';
import { useAuthStore } from '../../src/store/authStore';
import { signOut } from '../../src/services/supabase/auth';
import { Colors } from '../../src/constants/colors';
import { FontSizes, FontWeights } from '../../src/constants/typography';

export default function CaregiverDashboard() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { data: patients = [], isLoading: patientsLoading } = useLinkedPatients();
  const { data: alertCount = 0 } = useUnreadAlertCount();

  const handleSignOut = async () => {
    try { await signOut(); } catch (e) { console.error(e); }
  };

  return (
    <View style={styles.screen}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            Hello, {profile?.name?.split(' ')[0] ?? 'Caregiver'}
          </Text>
          <Text style={styles.headerSubtitle}>Caregiver Dashboard</Text>
        </View>

        {/* Alert badge */}
        <TouchableOpacity
          style={styles.alertButton}
          onPress={() => router.push('/(caregiver)/alerts')}
          accessibilityRole="button"
          accessibilityLabel={
            alertCount > 0
              ? `${alertCount} unread alert${alertCount !== 1 ? 's' : ''}`
              : 'No unread alerts'
          }
          accessibilityHint="Double tap to view your alert inbox"
        >
          <Text style={styles.alertIcon}>🔔</Text>
          {alertCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {alertCount > 99 ? '99+' : alertCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Patients ─────────────────────────────────────────────────── */}
        <SectionHeader title="YOUR PATIENTS" />

        {patientsLoading ? (
          <ActivityIndicator color={Colors.light.primary} style={styles.loader} />
        ) : patients.length === 0 ? (
          <EmptyCard
            message="No patients linked yet."
            action="Add a patient"
            onPress={() => router.push('/(caregiver)/patients')}
          />
        ) : (
          patients.map((rel) => (
            <PatientCard
              key={rel.id}
              name={rel.patient.name}
              patientId={rel.patient.id}
              onPressMedications={() =>
                router.push({
                  pathname: '/(caregiver)/medications',
                  params: { patientId: rel.patient.id, patientName: rel.patient.name },
                })
              }
            />
          ))
        )}

        {/* ── Quick actions ─────────────────────────────────────────────── */}
        <SectionHeader title="MANAGE" />

        <View style={styles.actionGrid}>
          <ActionCard
            icon="💊"
            label="Medications"
            onPress={() =>
              patients.length === 1
                ? router.push({
                    pathname: '/(caregiver)/medications',
                    params: {
                      patientId: patients[0].patient.id,
                      patientName: patients[0].patient.name,
                    },
                  })
                : router.push('/(caregiver)/patients')
            }
          />
          <ActionCard
            icon="📅"
            label="Schedules"
            onPress={() => router.push('/(caregiver)/schedules')}
          />
          <ActionCard
            icon="👥"
            label="Patients"
            onPress={() => router.push('/(caregiver)/patients')}
          />
          <ActionCard
            icon="🔔"
            label={alertCount > 0 ? `Alerts (${alertCount})` : 'Alerts'}
            onPress={() => router.push('/(caregiver)/alerts')}
            highlight={alertCount > 0}
          />
        </View>

        {/* ── Sign out ──────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title}</Text>
  );
}

interface PatientCardProps {
  name: string;
  patientId: string;
  onPressMedications: () => void;
}

function PatientCard({ name, onPressMedications }: PatientCardProps) {
  return (
    <TouchableOpacity
      style={styles.patientCard}
      onPress={onPressMedications}
      accessibilityRole="button"
      accessibilityLabel={`${name} — view medications`}
      accessibilityHint="Double tap to manage medications for this patient"
    >
      <View style={styles.patientAvatar}>
        <Text style={styles.patientAvatarText}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>{name}</Text>
        <Text style={styles.patientSubtext}>Tap to manage medications →</Text>
      </View>
    </TouchableOpacity>
  );
}

interface EmptyCardProps {
  message: string;
  action: string;
  onPress: () => void;
}

function EmptyCard({ message, action, onPress }: EmptyCardProps) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{message}</Text>
      <TouchableOpacity onPress={onPress} accessibilityRole="button">
        <Text style={styles.emptyAction}>{action} →</Text>
      </TouchableOpacity>
    </View>
  );
}

interface ActionCardProps {
  icon: string;
  label: string;
  onPress: () => void;
  highlight?: boolean;
}

function ActionCard({ icon, label, onPress, highlight }: ActionCardProps) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, highlight && styles.actionCardHighlight]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={[styles.actionLabel, highlight && styles.actionLabelHighlight]}>
        {label}
      </Text>
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
    justifyContent: 'space-between',
    backgroundColor: Colors.light.primary,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: FontSizes.caregiver.label,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 2,
  },
  alertButton: {
    position: 'relative',
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIcon: {
    fontSize: 26,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.light.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: FontWeights.bold,
  },
  scroll: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  loader: {
    marginVertical: 24,
  },
  sectionHeader: {
    fontSize: FontSizes.caregiver.caption,
    fontWeight: FontWeights.bold,
    color: Colors.light.secondary,
    letterSpacing: 1.2,
    marginTop: 8,
    marginBottom: 4,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientAvatarText: {
    fontSize: 20,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  patientInfo: {
    flex: 1,
    gap: 2,
  },
  patientName: {
    fontSize: FontSizes.caregiver.title,
    fontWeight: FontWeights.semibold,
    color: Colors.light.onBackground,
  },
  patientSubtext: {
    fontSize: FontSizes.caregiver.label,
    color: Colors.light.secondary,
  },
  emptyCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.secondary,
  },
  emptyAction: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.primary,
    fontWeight: FontWeights.semibold,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  actionCardHighlight: {
    borderColor: Colors.light.danger,
    backgroundColor: '#FFF5F5',
  },
  actionIcon: {
    fontSize: 28,
  },
  actionLabel: {
    fontSize: FontSizes.caregiver.label,
    fontWeight: FontWeights.semibold,
    color: Colors.light.onBackground,
    textAlign: 'center',
  },
  actionLabelHighlight: {
    color: Colors.light.danger,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  signOutText: {
    fontSize: FontSizes.caregiver.body,
    color: Colors.light.secondary,
  },
});
