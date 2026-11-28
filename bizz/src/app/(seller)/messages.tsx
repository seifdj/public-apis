import { MessageCircle } from 'lucide-react-native';

import { Placeholder } from '@/features/shell/Placeholder';
import { fr } from '@/i18n/fr';
import { colors } from '@/theme/theme';

export default function SellerMessagesScreen() {
  return <Placeholder heading={fr.nav.messages} icon={<MessageCircle color={colors.primary} size={28} />} title={fr.placeholders.messages.title} body={fr.placeholders.messages.body} />;
}
