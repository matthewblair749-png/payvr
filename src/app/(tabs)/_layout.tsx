import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { status } = useApp();
  // Still restoring the saved session: wait (don't bounce a deep link to the start).
  if (status === 'loading') return null;
  // Signed out (or session expired) → back through the splash to onboarding.
  if (status !== 'signedIn') return <Redirect href="/" />;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
