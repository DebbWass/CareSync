import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { TextInput } from 'react-native-paper';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { signUp } from '../../src/services/supabase/auth';
import { Colors } from '../../src/constants/colors';
import type { UserRole } from '../../src/types';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);

  async function handleRegister() {
    setFeedbackMessage('');
    setFeedbackError(false);

    if (!name.trim() || !email.trim() || !password || !role) {
      const msg = 'Please fill in all fields and select your role.';
      setFeedbackMessage(msg);
      setFeedbackError(true);
      Alert.alert('Missing fields', msg);
      return;
    }
    if (password.length < 8) {
      const msg = 'Password must be at least 8 characters.';
      setFeedbackMessage(msg);
      setFeedbackError(true);
      Alert.alert('Weak password', msg);
      return;
    }

    setLoading(true);
    try {
      console.log('[Register] Starting signup for email:', email.trim().toLowerCase());
      const result = await signUp(email.trim().toLowerCase(), password, name.trim(), role);
      
      if (result.session) {
        // If auth returns a session immediately, route explicitly so user sees progress.
        router.replace(role === 'caregiver' ? '/(caregiver)' : '/(patient)');
        return;
      }

      // Check if email verification is required
      if (result.user && !result.user.email_confirmed_at) {
        const msg = `We sent a confirmation link to ${result.user.email}. Please verify your email, then sign in.`;
        setFeedbackMessage(msg);
        setFeedbackError(false);
        Alert.alert(
          'Verify your email',
          msg,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        // Account created and auto-confirmed (or email verification disabled)
        setFeedbackMessage('Account created. Redirecting now...');
        setFeedbackError(false);
        Alert.alert('Success', 'Account created. Redirecting now.');
        router.replace(role === 'caregiver' ? '/(caregiver)' : '/(patient)');
      }
    } catch (err: unknown) {
      console.error('[Register] Signup error:', err);
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setFeedbackMessage(message);
      setFeedbackError(true);
      Alert.alert('Registration failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text size={28} weight="bold" color={Colors.light.primary} align="center">
            Create Account
          </Text>
          <Text size={15} color={Colors.light.secondary} align="center">
            Tell us about yourself to get started
          </Text>
        </View>

        {/* Role selector — most important decision */}
        <View style={styles.section}>
          <Text size={16} weight="semibold" style={styles.label}>
            I am a...
          </Text>
          <View style={styles.roleRow}>
            <RoleCard
              title="Patient"
              subtitle="I take medications and need reminders"
              emoji="💊"
              selected={role === 'patient'}
              onPress={() => setRole('patient')}
            />
            <RoleCard
              title="Caregiver"
              subtitle="I manage medications for someone I care for"
              emoji="🤝"
              selected={role === 'caregiver'}
              onPress={() => setRole('caregiver')}
            />
          </View>
        </View>

        {/* Form fields */}
        <View style={styles.form}>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Your full name"
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
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Password, minimum 8 characters"
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              />
            }
          />
        </View>

        <Button
          label="Create Account"
          onPress={handleRegister}
          loading={loading}
          accessibilityLabel="Submit registration form"
        />

        {feedbackMessage ? (
          <Text
            size={14}
            color={feedbackError ? Colors.light.danger : Colors.light.secondary}
            align="center"
          >
            {feedbackMessage}
          </Text>
        ) : null}

        <Button
          label="Already have an account? Sign In"
          onPress={() => router.back()}
          variant="outline"
          accessibilityLabel="Go back to sign in screen"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Role selection card component
function RoleCard({
  title,
  subtitle,
  emoji,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.roleCard, selected && styles.roleCardSelected]}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ selected }}
    >
      <Text size={32} align="center">{emoji}</Text>
      <Text size={16} weight="bold" color={selected ? Colors.light.primary : Colors.light.onBackground} align="center">
        {title}
      </Text>
      <Text size={12} color={Colors.light.secondary} align="center">
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.light.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 24,
  },
  header: { gap: 8 },
  section: { gap: 12 },
  label: { marginBottom: 4 },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    alignItems: 'center',
  },
  roleCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#EBF4FF',
  },
  form: { gap: 12 },
  input: { backgroundColor: Colors.light.background },
});
