import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { TextInput } from 'react-native-paper';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { signIn } from '../../src/services/supabase/auth';
import { Colors } from '../../src/constants/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // AuthGuard in _layout.tsx handles the redirect after session updates
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      Alert.alert('Login failed', message);
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
        {/* Logo / App name */}
        <View style={styles.header}>
          <Text size={36} weight="bold" color={Colors.light.primary} align="center">
            CareSync
          </Text>
          <Text size={16} color={Colors.light.secondary} align="center">
            Medication management made simple
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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
            autoComplete="password"
            mode="outlined"
            style={styles.input}
            accessibilityLabel="Password"
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              />
            }
          />

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.button}
            accessibilityLabel="Sign in to CareSync"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text size={14} color={Colors.light.secondary} align="center">
            Don't have an account?{' '}
          </Text>
          <Button
            label="Create Account"
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
            style={styles.secondaryButton}
            accessibilityLabel="Go to create account screen"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.light.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 32,
  },
  header: { gap: 8 },
  form: { gap: 16 },
  input: { backgroundColor: Colors.light.background },
  button: { marginTop: 8 },
  footer: { gap: 12, alignItems: 'center' },
  secondaryButton: { maxWidth: 240 },
});
