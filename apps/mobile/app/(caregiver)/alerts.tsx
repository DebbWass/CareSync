import { useCallback, useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/store/authStore';
import { supabase } from '../../src/lib/supabase';

interface CaregiverAlert {
  id: string;
  alertType: string;
  isRead: boolean;
  createdAt: string;
  patientId: string;
}

export default function AlertsScreen() {
  const { supabaseUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);

  const loadAlerts = useCallback(async () => {
    if (!supabaseUser?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('id, alert_type, is_read, created_at, patient_id')
        .eq('caregiver_id', supabaseUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAlerts(
        (data ?? []).map((item) => ({
          id: item.id as string,
          alertType: String(item.alert_type ?? 'alert'),
          isRead: Boolean(item.is_read),
          createdAt: String(item.created_at ?? ''),
          patientId: String(item.patient_id ?? ''),
        }))
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not load alerts.';
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [supabaseUser?.id]);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
  );

  async function markAsRead(alertId: string) {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts((prev) =>
        prev.map((item) => (item.id === alertId ? { ...item, isRead: true } : item))
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not update alert.';
      Alert.alert('Update failed', message);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAlerts} />}
    >
      <Text size={30} weight="bold" color={Colors.light.primary}>
        Alerts
      </Text>

      {alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text size={16} color={Colors.light.secondary} align="center">
            No alerts right now.
          </Text>
        </View>
      ) : (
        alerts.map((alertItem) => (
          <View key={alertItem.id} style={styles.alertCard}>
            <Text size={16} weight="bold">
              {alertItem.alertType.replace(/_/g, ' ')}
            </Text>
            <Text size={13} color={Colors.light.secondary}>
              Patient: {alertItem.patientId}
            </Text>
            <Text size={13} color={Colors.light.secondary}>
              {new Date(alertItem.createdAt).toLocaleString()}
            </Text>

            {alertItem.isRead ? (
              <Text size={13} color={Colors.light.confirm}>Read</Text>
            ) : (
              <TouchableOpacity
                style={styles.readButton}
                onPress={() => markAsRead(alertItem.id)}
              >
                <Text size={13} color={Colors.light.onPrimary} align="center">Mark as Read</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
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
    gap: 12,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    padding: 12,
    gap: 6,
  },
  readButton: {
    marginTop: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
});
