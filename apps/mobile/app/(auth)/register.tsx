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
import { signUp } from '../../src/services/supabase/auth';
import { Colors } from '../../src/constants/colors';
import type { UserRole } from '../../src/types';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('caregiver');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, name.trim(), role);
      // Navigation handled by root layout's auth guard after session is set
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(msg);
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
            CareSync
          </Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Full name"
          />

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Email address"
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoComplete="new-password"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Password"
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible((v) => !v)}
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              />
            }
          />

          {/* Role selector */}
          <Text style={styles.roleLabel}>I am a:</Text>
          <View style={styles.roleRow} accessibilityRole="radiogroup">
            <RoleOption
              label="Caregiver"
              description="I manage medications for a patient"
              selected={role === 'caregiver'}
              onPress={() => setRole('caregiver')}
            />
            <RoleOption
              label="Patient"
              description="I receive medication reminders"
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
            accessibilityLabel="Create CareSync account"
            accessibilityHint="Double tap to register with the information above"
          >
            Create Account
          </Button>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text style={styles.link}>Sign In</Text>
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
      <Text style={[styles.roleCardTitle, selected && styles.roleCardTitleSelected]}>
        {label}
      </Text>
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
