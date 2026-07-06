import { useCallback, useState } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/store/authStore';
import { supabase } from '../../src/lib/supabase';

export default function CaregiverDashboardScreen() {
  const { profile, supabaseUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [activeMedicationsCount, setActiveMedicationsCount] = useState(0);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  const loadDashboardData = useCallback(async () => {
    if (!supabaseUser?.id) return;

    setLoading(true);
    try {
      const [relationshipsResult, medsResult, alertsResult] = await Promise.all([
        supabase
          .from('patient_caregiver_relationships')
          .select('id', { count: 'exact', head: true })
          .eq('caregiver_id', supabaseUser.id)
          .eq('status', 'active'),
        supabase
          .from('medications')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('caregiver_id', supabaseUser.id)
          .eq('is_read', false),
      ]);

      setActivePatientsCount(relationshipsResult.count ?? 0);
      setActiveMedicationsCount(medsResult.count ?? 0);
      setUnreadAlertsCount(alertsResult.count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [supabaseUser?.id]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadDashboardData} />
      }
    >
      <Text size={32} weight="bold" color={Colors.light.primary}>
        Dashboard
      </Text>
      <Text size={16} color={Colors.light.secondary}>
        {profile?.name ? `Welcome back, ${profile.name}` : 'Welcome back'}
      </Text>

      <View style={styles.statsRow}>
        <StatCard label="Active patients" value={activePatientsCount} />
        <StatCard label="Active medications" value={activeMedicationsCount} />
        <StatCard label="Unread alerts" value={unreadAlertsCount} />
      </View>

      <View style={styles.actions}>
        <Button
          label="Manage Patients"
          onPress={() => router.push('/(caregiver)/patients')}
          accessibilityLabel="Go to patient management"
        />
        <Button
          label="Add Medication"
          onPress={() => router.push('/(caregiver)/medications')}
          accessibilityLabel="Go to medications"
        />
        <Button
          label="Create Schedule"
          onPress={() => router.push('/(caregiver)/schedules/index' as never)}
          variant="outline"
          accessibilityLabel="Go to schedules"
        />
        <Button
          label="Open Alerts"
          onPress={() => router.push('/(caregiver)/alerts')}
          variant="outline"
          accessibilityLabel="Go to alerts"
        />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text size={28} weight="bold" color={Colors.light.primary} align="center">
        {value}
      </Text>
      <Text size={13} color={Colors.light.secondary} align="center">
        {label}
      </Text>
    </View>
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
    paddingBottom: 40,
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 4,
  },
  actions: {
    marginTop: 14,
    gap: 10,
  },
});
