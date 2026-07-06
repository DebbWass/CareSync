import { useMemo, useState } from 'react';
import { Alert, Pressable, Text as RNText } from 'react-native';
import { Tabs } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { signOut } from '../../src/services/supabase/auth';

function HeaderSignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      await signOut();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not sign out.';
      Alert.alert('Sign out failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Pressable
      onPress={handleSignOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
    >
      <RNText
        style={{
          color: Colors.light.primary,
          fontWeight: '700',
          fontSize: 15,
          opacity: loading ? 0.5 : 1,
        }}
      >
        Sign out
      </RNText>
    </Pressable>
  );
}

export default function PatientLayout() {
  const insets = useSafeAreaInsets();
  const tabBarStyle = useMemo(
    () => ({
      height: 58 + insets.bottom,
      paddingBottom: Math.max(insets.bottom, 10),
      paddingTop: 6,
    }),
    [insets.bottom]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerRight: () => <HeaderSignOutButton />,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.secondary,
        tabBarStyle,
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="pill" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Today — current medication reminders',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'History — past medication events',
        }}
      />
    </Tabs>
  );
}
