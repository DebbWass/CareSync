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
import { useTranslation } from 'react-i18next';
import {
  useDeactivateMedication,
  useMedication,
  useUpdateMedication,
} from '../../../src/hooks/useMedications';
import { ErrorBanner } from '../../../src/components/ui/ErrorBanner';
import { normalizeSupabaseError } from '../../../src/services/supabase/errors';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';

export default function EditMedicationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, patientId, patientName } = useLocalSearchParams<{
    id: string;
    patientId: string;
    patientName: string;
  }>();

  const { data: medication, isLoading, error: loadError, refetch } = useMedication(id);
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
    if (!name.trim()) {
      setError(t('medications.form.nameRequired'));
      return;
    }
    if (!dosage.trim()) {
      setError(t('medications.form.dosageRequired'));
      return;
    }
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
          setError(t(normalizeSupabaseError(err).messageKey));
        },
      }
    );
  };

  const handleDeactivate = () => {
    if (!id) return;
    Alert.alert(
      t('medications.edit.removeTitle'),
      t('medications.edit.removeMessage', { name: medication?.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('medications.edit.removeConfirm'),
          style: 'destructive',
          onPress: () => {
            deactivateMutation.mutate(id, {
              onSuccess: () => router.back(),
              onError: (err: unknown) => {
                setError(t(normalizeSupabaseError(err).messageKey));
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

  if (loadError || !medication) {
    return (
      <View style={styles.center}>
        {loadError ? (
          <ErrorBanner error={loadError} onRetry={refetch} />
        ) : (
          <Text style={styles.errorText}>{t('medications.edit.notFound')}</Text>
        )}
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>{t('medications.edit.goBack')}</Text>
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
          accessibilityLabel={t('medications.form.cancelLabel')}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('medications.edit.title')}</Text>
          {patientName ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {t('medications.form.forPatient', { name: patientName })}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextInput
            label={t('medications.form.nameLabel')}
            value={name}
            onChangeText={(v) => setEdits((e) => ({ ...e, name: v }))}
            autoCapitalize="words"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('medications.form.nameA11y')}
          />

          <TextInput
            label={t('medications.form.dosageLabel')}
            value={dosage}
            onChangeText={(v) => setEdits((e) => ({ ...e, dosage: v }))}
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('medications.form.dosageA11y')}
          />

          <TextInput
            label={t('medications.form.instructionsLabel')}
            value={instructions}
            onChangeText={(v) => setEdits((e) => ({ ...e, instructions: v }))}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            accessibilityLabel={t('medications.form.instructionsA11y')}
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
            accessibilityLabel={t('medications.edit.saveA11y')}
          >
            {t('medications.edit.saveButton')}
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
            accessibilityLabel={t('medications.edit.manageSchedulesA11y')}
          >
            {t('medications.edit.manageSchedules')}
          </Button>

          <Button
            mode="outlined"
            onPress={handleDeactivate}
            loading={deactivateMutation.isPending}
            disabled={updateMutation.isPending || deactivateMutation.isPending}
            style={styles.deactivateButton}
            contentStyle={styles.buttonContent}
            textColor={Colors.light.danger}
            accessibilityLabel={t('medications.edit.removeA11y')}
            accessibilityHint={t('medications.edit.removeHint')}
          >
            {t('medications.edit.removeButton')}
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
