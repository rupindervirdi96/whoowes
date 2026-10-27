import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useSettlement, useRespondToSettlement, useCancelSettlement } from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { useShowModal } from '../../store/uiStore';
import { formatCurrency } from '../../utils/currency';
import { formatFullDate, timeAgo } from '../../utils/date';
import { firstName } from '../../utils/money';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const SettlementDetailScreen: React.FC<RootScreenProps<'SettlementDetail'>> = ({ route, navigation }) => {
  const { settlementId } = route.params;
  const t = useTheme();
  const me = useCurrentUser()!;
  const { data: s, isLoading } = useSettlement(settlementId);
  const respond = useRespondToSettlement();
  const cancel = useCancelSettlement();
  const showModal = useShowModal();

  if (isLoading) {
    return (
      <Screen>
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  if (!s) {
    return (
      <Screen>
        <EmptyState emoji="🫥" title="Payment not found" actionLabel="Go back" onAction={() => navigation.goBack()} />
      </Screen>
    );
  }

  const iSent = s.fromUserId === me.id;
  const iReceive = s.toUserId === me.id;
  const status = {
    pending: { tone: 'warning' as const, label: iReceive ? 'Waiting for you to confirm' : `Waiting for ${firstName(s.toUser.name)} to confirm`, icon: 'schedule' },
    confirmed: { tone: 'positive' as const, label: 'Confirmed', icon: 'check-circle' },
    rejected: { tone: 'negative' as const, label: 'Declined', icon: 'cancel' },
  }[s.status];

  const timeline = [
    { label: `${iSent ? 'You' : firstName(s.fromUser.name)} recorded the payment`, date: s.initiatedAt, color: t.colors.primary },
    s.confirmedAt ? { label: `${iReceive ? 'You' : firstName(s.toUser.name)} confirmed it`, date: s.confirmedAt, color: t.colors.positive } : null,
    s.rejectedAt ? { label: `${iReceive ? 'You' : firstName(s.toUser.name)} declined it`, date: s.rejectedAt, color: t.colors.negative } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <Screen
      footer={
        s.status === 'pending' ? (
          iReceive ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Didn’t get it"
                variant="danger"
                style={{ flex: 1 }}
                onPress={() =>
                  showModal({
                    title: 'Decline this payment?',
                    body: `${firstName(s.fromUser.name)} will see that you haven’t received it.`,
                    confirmLabel: 'Decline',
                    variant: 'danger',
                    onConfirm: () => respond.mutate({ settlementId: s.id, action: 'reject' }),
                  })
                }
              />
              <Button
                title="Yes, I got it"
                icon="check"
                style={{ flex: 1 }}
                loading={respond.isPending}
                onPress={() => respond.mutate({ settlementId: s.id, action: 'confirm' })}
              />
            </View>
          ) : iSent ? (
            <Button
              title="Cancel payment"
              variant="secondary"
              fullWidth
              loading={cancel.isPending}
              onPress={() =>
                showModal({
                  title: 'Cancel this payment?',
                  body: 'It will be removed and your balance won’t change.',
                  confirmLabel: 'Cancel payment',
                  cancelLabel: 'Keep it',
                  variant: 'danger',
                  onConfirm: () => cancel.mutate(s.id, { onSuccess: () => navigation.goBack() }),
                })
              }
            />
          ) : undefined
        ) : undefined
      }
    >
      <View style={{ alignItems: 'center', paddingVertical: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={s.fromUser.name} size="lg" />
          <Icon name="arrow-forward" size={26} color={t.colors.textTertiary} />
          <Avatar name={s.toUser.name} size="lg" />
        </View>
        <Text variant="display" tabular style={{ marginTop: t.spacing.base }}>
          {formatCurrency(s.amount, s.currency)}
        </Text>
        <Text tone="secondary">
          {iSent ? 'You' : s.fromUser.name} → {iReceive ? 'you' : s.toUser.name}
        </Text>
        <Badge label={status.label} tone={status.tone} icon={status.icon} style={{ alignSelf: 'center', marginTop: 12 }} />
      </View>

      {s.note ? (
        <Card variant="alt">
          <Text variant="caption" tone="tertiary">
            Note
          </Text>
          <Text style={{ marginTop: 2 }}>{s.note}</Text>
        </Card>
      ) : null}

      <SectionHeader title="Timeline" />
      <Card>
        {timeline.map((step, i) => (
          <View key={step.label} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: step.color, marginTop: 4 }} />
              {i < timeline.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: t.colors.border, marginVertical: 2 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: i < timeline.length - 1 ? 16 : 0 }}>
              <Text variant="bodyStrong">{step.label}</Text>
              <Text variant="caption" tone="tertiary">
                {formatFullDate(step.date)} · {timeAgo(step.date)}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
};

export default SettlementDetailScreen;
