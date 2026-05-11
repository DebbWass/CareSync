import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';

export default function CaregiverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.secondary,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarAccessibilityLabel: 'Dashboard — patient adherence overview',
        }}
      />
      <Tabs.Screen
        name="medications/index"
        options={{
          title: 'Medications',
          tabBarAccessibilityLabel: 'Medications — manage patient medications',
        }}
      />
      <Tabs.Screen
        name="patients/index"
        options={{
          title: 'Patients',
          tabBarAccessibilityLabel: 'Patients — manage your linked patients',
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarAccessibilityLabel: 'Alerts — missed medication notifications',
        }}
      />
    </Tabs>
  );
}
