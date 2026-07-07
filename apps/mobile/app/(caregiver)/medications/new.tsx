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
import { useTranslation } from 'react-i18next';
import { useCreateMedication } from '../../../src/hooks/useMedications';
import { normalizeSupabaseError } from '../../../src/services/supabase/errors';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';

export default function NewMedicationScreen() {
  const { t } = useTranslation();
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
    if (!name.trim()) {
      setError(t('medications.form.nameRequired'));
      return;
    }
    if (!dosage.trim()) {
      setError(t('medications.form.dosageRequired'));
      return;
    }
    if (!patientId) {
      setError(t('medications.form.noPatient'));
      return;
    }

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
          setError(t(normalizeSupabaseError(err).messageKey));
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
          accessibilityLabel={t('medications.form.cancelLabel')}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('medications.form.addTitle')}</Text>
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
            onChangeText={setName}
            autoCapitalize="words"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('medications.form.nameA11y')}
            placeholder={t('medications.form.namePlaceholder')}
          />

          <TextInput
            label={t('medications.form.dosageLabel')}
            value={dosage}
            onChangeText={setDosage}
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('medications.form.dosageA11y')}
            placeholder={t('medications.form.dosagePlaceholder')}
          />

          <TextInput
            label={t('medications.form.instructionsLabel')}
            value={instructions}
            onChangeText={setInstructions}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            accessibilityLabel={t('medications.form.instructionsA11y')}
            placeholder={t('medications.form.instructionsPlaceholder')}
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
            accessibilityLabel={t('medications.form.saveA11y')}
          >
            {t('medications.form.saveButton')}
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
