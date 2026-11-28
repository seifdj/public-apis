import { Tabs, useRouter } from 'expo-router';
import { LayoutDashboard, LayoutGrid, MessageCircle, Store } from 'lucide-react-native';

import { fr } from '@/i18n/fr';
import { GlassTabBar } from '@/ui';

const icons = { dashboard: LayoutDashboard, posts: LayoutGrid, messages: MessageCircle, shop: Store };

/** Seller navigation: Espace, Publications, (+ Publier), Messages, Boutique. */
export default function SellerLayout() {
  const router = useRouter();
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <GlassTabBar {...props} icons={icons} centerAction={{ label: fr.nav.publish, onPress: () => router.push('/publish') }} />}>
      <Tabs.Screen name="dashboard" options={{ title: fr.nav.dashboard }} />
      <Tabs.Screen name="posts" options={{ title: fr.nav.posts }} />
      <Tabs.Screen name="messages" options={{ title: fr.nav.messages }} />
      <Tabs.Screen name="shop" options={{ title: fr.nav.shop }} />
    </Tabs>
  );
}
