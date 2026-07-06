import { useCallback, useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { Colors } from '../../../src/constants/colors';
import { supabase } from '../../../src/lib/supabase';

interface MedicationOption {
  id: string;
  name: string;
  patientId: string;
}

interface ScheduleItem {
  id: string;
  frequencyType: string;
  timesOfDay: string[];
  startDate: string;
  endDate: string | null;
}

export default function SchedulesScreen() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [medications, setMedications] = useState<MedicationOption[]>([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

  const [frequencyType, setFrequencyType] = useState('daily');
  const [timesInput, setTimesInput] = useState('08:00,20:00');
  const [daysInput, setDaysInput] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');

  const loadMedications = useCallback(async () => {
    const { data, error } = await supabase
      .from('medications')
      .select('id, name, patient_id')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const options = (data ?? []).map((item) => ({
      id: item.id as string,
      name: String(item.name ?? 'Medication'),
      patientId: String(item.patient_id ?? ''),
    }));

    setMedications(options);
    setSelectedMedicationId((prev) => prev ?? options[0]?.id ?? null);
  }, []);

  const loadSchedules = useCallback(async (medicationId: string | null) => {
    if (!medicationId) {
      setSchedules([]);
      return;
    }

    const { data, error } = await supabase
      .from('medication_schedules')
      .select('id, frequency_type, times_of_day, start_date, end_date')
      .eq('medication_id', medicationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setSchedules(
      (data ?? []).map((item) => ({
        id: item.id as string,
        frequencyType: String(item.frequency_type ?? 'daily'),
        timesOfDay: Array.isArray(item.times_of_day)
          ? (item.times_of_day as string[])
          : [],
        startDate: String(item.start_date ?? ''),
        endDate: item.end_date ? String(item.end_date) : null,
      }))
    );
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadMedications();
      await loadSchedules(selectedMedicationId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not load schedules.';
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [loadMedications, loadSchedules, selectedMedicationId]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  async function handleCreateSchedule() {
    if (!selectedMedicationId) {
      Alert.alert('Missing medication', 'Choose a medication first.');
      return;
    }

    const parsedTimes = timesInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const invalidTime = parsedTimes.some((time) => !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time));
    if (parsedTimes.length === 0 || invalidTime) {
      Alert.alert('Invalid times', 'Use comma-separated HH:MM values, for example 08:00,20:00.');
      return;
    }

    const parsedDays = daysInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => Number(item))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

    setSubmitting(true);
    try {
      const payload: {
        medication_id: string;
        frequency_type: string;
        times_of_day: string[];
        start_date: string;
        end_date: string | null;
        days_of_week?: number[];
      } = {
        medication_id: selectedMedicationId,
        frequency_type: frequencyType,
        times_of_day: parsedTimes,
        start_date: startDate,
        end_date: endDate.trim() ? endDate.trim() : null,
      };

      if (parsedDays.length > 0) {
        payload.days_of_week = parsedDays;
      }

      const { error } = await supabase.from('medication_schedules').insert(payload);
      if (error) throw error;

      await loadSchedules(selectedMedicationId);
      Alert.alert('Created', 'Schedule added successfully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not create schedule.';
      Alert.alert('Create failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} />}
    >
      <Text size={30} weight="bold" color={Colors.light.primary}>
        Schedules
      </Text>

      <View style={styles.card}>
        <Text size={16} weight="semibold">Choose Medication</Text>
        {medications.length === 0 ? (
          <Text size={14} color={Colors.light.secondary}>
            No active medications found. Add medication first.
          </Text>
        ) : (
          <View style={styles.chipWrap}>
            {medications.map((item) => {
              const selected = item.id === selectedMedicationId;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => {
                    setSelectedMedicationId(item.id);
                    loadSchedules(item.id).catch(() => {});
                  }}
                >
                  <Text size={13} color={selected ? Colors.light.onPrimary : Colors.light.primary}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text size={16} weight="semibold">Add Schedule</Text>
        <TextInput
          mode="outlined"
          label="Frequency (daily/weekly/custom...)"
          value={frequencyType}
          onChangeText={setFrequencyType}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          mode="outlined"
          label="Times (HH:MM, comma separated)"
          value={timesInput}
          onChangeText={setTimesInput}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          mode="outlined"
          label="Days of week 0-6 (optional, comma separated)"
          value={daysInput}
          onChangeText={setDaysInput}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          mode="outlined"
          label="Start Date (YYYY-MM-DD)"
          value={startDate}
          onChangeText={setStartDate}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          mode="outlined"
          label="End Date (optional YYYY-MM-DD)"
          value={endDate}
          onChangeText={setEndDate}
          style={styles.input}
          autoCapitalize="none"
        />
        <Button
          label="Create Schedule"
          onPress={handleCreateSchedule}
          loading={submitting}
          disabled={!selectedMedicationId}
        />
      </View>

      <View style={styles.listSection}>
        <Text size={18} weight="semibold">Current Schedules</Text>
        {schedules.length === 0 ? (
          <View style={styles.emptyState}>
            <Text size={14} color={Colors.light.secondary} align="center">
              No schedules for selected medication.
            </Text>
          </View>
        ) : (
          schedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleCard}>
              <Text size={16} weight="bold">{schedule.frequencyType}</Text>
              <Text size={13} color={Colors.light.secondary}>
                Times: {schedule.timesOfDay.join(', ')}
              </Text>
              <Text size={13} color={Colors.light.secondary}>
                Start: {schedule.startDate}
              </Text>
              {schedule.endDate ? (
                <Text size={13} color={Colors.light.secondary}>
                  End: {schedule.endDate}
                </Text>
              ) : null}
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.background,
  },
  chipSelected: {
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
  scheduleCard: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    padding: 12,
    gap: 4,
  },
});