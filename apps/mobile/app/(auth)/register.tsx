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
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { signUp } from '../../src/services/supabase/auth';
import { normalizeSupabaseError } from '../../src/services/supabase/errors';
import { Colors } from '../../src/constants/colors';
import { MIN_PASSWORD_LENGTH } from '../../src/constants/config';
import type { UserRole } from '../../src/types';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('caregiver');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError(t('auth.login.fillAllFields'));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.register.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, name.trim(), role);
      // Navigation handled by root layout's auth guard after session is set
    } catch (err: unknown) {
      setError(t(normalizeSupabaseError(err).messageKey));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName} accessibilityRole="header">
            {t('common.appName')}
          </Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            label={t('auth.register.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('auth.register.nameA11y')}
          />

          <TextInput
            label={t('auth.login.emailLabel')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('auth.login.emailA11y')}
          />

          <TextInput
            label={t('auth.login.passwordLabel')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoComplete="new-password"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('auth.login.passwordLabel')}
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible((v) => !v)}
                accessibilityLabel={
                  passwordVisible ? t('auth.login.hidePassword') : t('auth.login.showPassword')
                }
              />
            }
          />

          {/* Role selector */}
          <Text style={styles.roleLabel}>{t('auth.register.roleLabel')}</Text>
          <View style={styles.roleRow} accessibilityRole="radiogroup">
            <RoleOption
              label={t('auth.register.roleCaregiver')}
              description={t('auth.register.roleCaregiverDesc')}
              selected={role === 'caregiver'}
              onPress={() => setRole('caregiver')}
            />
            <RoleOption
              label={t('auth.register.rolePatient')}
              description={t('auth.register.rolePatientDesc')}
              selected={role === 'patient'}
              onPress={() => setRole('patient')}
            />
          </View>

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            accessibilityLabel={t('auth.register.createAccountA11y')}
            accessibilityHint={t('auth.register.createAccountHint')}
          >
            {t('auth.register.createAccount')}
          </Button>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{t('auth.register.haveAccount')}</Text>
            <Link href="/(auth)/login">
              <Text style={styles.link}>{t('auth.register.signInLink')}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Role option card ──────────────────────────────────────────────────────────

interface RoleOptionProps {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

function RoleOption({ label, description, selected, onPress }: RoleOptionProps) {
  return (
    <TouchableOpacity
      style={[styles.roleCard, selected && styles.roleCardSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={description}
    >
      <Text style={[styles.roleCardTitle, selected && styles.roleCardTitleSelected]}>{label}</Text>
      <Text style={[styles.roleCardDesc, selected && styles.roleCardDescSelected]}>
        {description}
      </Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appName: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.light.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondary,
    marginTop: 6,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: Colors.light.background,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.onBackground,
    marginTop: 4,
    marginBottom: 4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderRadius: 10,
    padding: 14,
    backgroundColor: Colors.light.surface,
  },
  roleCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#EBF3FB',
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.secondary,
    marginBottom: 4,
  },
  roleCardTitleSelected: {
    color: Colors.light.primary,
  },
  roleCardDesc: {
    fontSize: 12,
    color: Colors.light.secondary,
    lineHeight: 16,
  },
  roleCardDescSelected: {
    color: Colors.light.primary,
  },
  errorText: {
    color: Colors.light.danger,
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    height: 52,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  linkText: {
    color: Colors.light.secondary,
    fontSize: 14,
  },
  link: {
    color: Colors.light.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
