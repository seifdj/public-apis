import { Ban, CircleCheck, Flag } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { type ReportReason, reportTarget, type ReportTargetType } from '@/features/social/api';
import { useBlockActions } from '@/features/social/hooks';
import { fr } from '@/i18n/fr';
import { toUserMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/theme';
import { EmptyState, ListRow, PillButton, Sheet, Text, TextField } from '@/ui';

const REASONS: ReportReason[] = ['forbidden_item', 'counterfeit', 'scam', 'adult', 'harassment', 'spam', 'wrong_category', 'other'];

export interface ContentMenuProps {
  visible: boolean;
  onClose: () => void;
  /** What "Signaler" reports. */
  target: { type: ReportTargetType; id: string };
  /** Who "Bloquer" blocks. */
  seller: { userId: string; name: string };
  onBlocked?: () => void;
}

type Step = 'menu' | 'reasons' | 'sent' | 'block' | 'blocked';

/** The "…" sheet on a post or a shop: report (with a reason) or block the seller. */
export function ContentMenu({ visible, onClose, target, seller, onBlocked }: ContentMenuProps) {
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { block } = useBlockActions();

  const close = () => {
    onClose();
    const wasBlocked = step === 'blocked';
    setStep('menu');
    setReason(null);
    setDetails('');
    setError(null);
    if (wasBlocked) onBlocked?.();
  };

  const submitReport = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await reportTarget(target.type, target.id, reason, details);
      setStep('sent');
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmBlock = () => {
    setError(null);
    block.mutate(seller.userId, { onSuccess: () => setStep('blocked'), onError: (e) => setError(toUserMessage(e)) });
  };

  return (
    <Sheet visible={visible} onClose={close} title={step === 'reasons' ? fr.report.title : step === 'block' ? fr.report.blockTitle(seller.name) : undefined}>
      {step === 'menu' ? (
        <View>
          <ListRow first icon={<Flag color={colors.primary} size={20} />} label={target.type === 'post' ? fr.report.menuReportPost : fr.report.menuReportShop} onPress={() => setStep('reasons')} />
          <ListRow tone="danger" icon={<Ban color={colors.danger} size={20} />} label={fr.report.menuBlock} onPress={() => setStep('block')} />
        </View>
      ) : null}

      {step === 'reasons' ? (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {REASONS.map((r, i) => (
            <ListRow key={r} first={i === 0} label={fr.report.reasons[r]} onPress={() => setReason(r)} right={reason === r ? <CircleCheck color={colors.primary} size={20} /> : <View style={styles.radio} />} />
          ))}
          <View style={styles.block}>
            <TextField label={fr.report.details} optional={fr.common.optional} value={details} onChangeText={setDetails} placeholder={fr.report.detailsPlaceholder} maxLength={500} multiline />
          </View>
          {error ? (
            <Text variant="caption" tone="danger" align="center" style={styles.block}>
              {error}
            </Text>
          ) : null}
          <PillButton label={fr.report.submit} size="lg" fullWidth loading={busy} disabled={!reason} onPress={submitReport} style={styles.block} testID="report-submit" />
        </ScrollView>
      ) : null}

      {step === 'sent' ? <EmptyState icon={<CircleCheck color={colors.success} size={28} />} title={fr.report.sentTitle} description={fr.report.sentBody} actionLabel={fr.common.close} onAction={close} /> : null}

      {step === 'block' ? (
        <View style={styles.gap}>
          <Text tone="secondary">{fr.report.blockBody}</Text>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          <PillButton label={fr.report.blockConfirm} variant="danger" size="lg" fullWidth loading={block.isPending} onPress={confirmBlock} testID="block-confirm" />
          <PillButton label={fr.common.cancel} variant="secondary" fullWidth onPress={close} />
        </View>
      ) : null}

      {step === 'blocked' ? <EmptyState icon={<Ban color={colors.primary} size={28} />} title={fr.report.blocked} actionLabel={fr.common.close} onAction={close} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg },
  gap: { gap: spacing.md },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
});
