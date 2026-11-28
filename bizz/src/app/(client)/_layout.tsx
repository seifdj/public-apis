import { Tabs, useRouter } from 'expo-router';
import { Home, MessageCircle, Search, User } from 'lucide-react-native';

import { useMyProfile, useSwitchMode } from '@/features/account/hooks';
import { fr } from '@/i18n/fr';
import { GlassTabBar } from '@/ui';

const icons = { feed: Home, search: Search, messages: MessageCircle, profile: User };

/** Client navigation: Feed, Recherche, (+), Messages, Profil. */
export default function ClientLayout() {
  const router = useRouter();
  const profile = useMyProfile().data;
  const switchMode = useSwitchMode();

  // "+" : a client opens their shop; a seller browsing in client mode goes back to publishing.
  const onPlus = () => {
    if (profile?.role === 'seller') {
      switchMode.mutate('seller', { onSuccess: () => router.replace('/(seller)/dashboard') });
    } else {
      router.push('/open-shop');
    }
  };

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} icons={icons} centerAction={{ label: profile?.role === 'seller' ? fr.nav.publish : fr.nav.openShop, onPress: onPlus }} />}
    >
      <Tabs.Screen name="feed" options={{ title: fr.nav.feed }} />
      <Tabs.Screen name="search" options={{ title: fr.nav.search }} />
      <Tabs.Screen name="messages" options={{ title: fr.nav.messages }} />
      <Tabs.Screen name="profile" options={{ title: fr.nav.profile }} />
    </Tabs>
  );
}
