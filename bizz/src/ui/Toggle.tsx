import { Platform, Switch, type SwitchProps } from 'react-native';

import { colors } from '@/theme/theme';

// react-native-web has its own colour props; without them the thumb turns green when on.
const webColors = Platform.OS === 'web' ? ({ activeThumbColor: colors.surface, activeTrackColor: colors.primary } as object) : null;

/** On/off switch in the brand colours. `accessibilityLabel` is required: the switch has no visible text of its own. */
export function Toggle(props: SwitchProps & { accessibilityLabel: string }) {
  return <Switch trackColor={{ true: colors.primary, false: colors.muted }} thumbColor={colors.surface} ios_backgroundColor={colors.muted} {...webColors} {...props} />;
}
