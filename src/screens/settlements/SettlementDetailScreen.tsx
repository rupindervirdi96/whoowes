/**
 * Settlement Detail Screen â€” full details of a single settlement
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { SettlementsStackParamList } from '../../types/navigation';
import { SettlementStatus } from '../../types';
import {
  useSettlement,
  useRespondToSettlement,
  useCancelSettlement,
} from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { useShowModal } from '../../store/uiStore';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<SettlementsStackParamList, 'SettlementDetail'>;

const SettlementDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { settlementId } = route.params;
  const currentUser = useCurrentUser();
  const { data: settlement, isLoading } = useSettlement(settlementId);
  const { mutate: respond, isPending: responding } = useRespondToSettlement();
  const { mutate: cancel, isPending: cancelling } = useCancelSettlement();
  const showModal = useShowModal();

  const isInitiator = settlement?.fromUserId === currentUser?.id;
  const isRecipient = settlement?.toUserId === currentUser?.id;

  const handleConfirm = () => {
    if (!settlement) return;
    showModal({
      title: 'Confirm Settlement',
      body: `Confirm that you received ${settlement.currency} ${settlement.amount.toFixed(2)} from ${settlement.fromUser.name}?`,
      confirmLabel: 'Confirm Receipt',
      onConfirm: () => {
        respond(
          { settlementId: settlement.id, action: 'confirm' },
          { onSuccess: () => navigation.goBack() },
        );
      },
    });
  };

  const handleReject = () => {
    if (!settlement) return;
    showModal({
      title: 'Reject Settlement',
      body: `Reject this payment of ${settlement.currency} ${settlement.amount.toFixed(2)}?`,
      confirmLabel: 'Reject',
      variant: 'danger',
      onConfirm: () => {
        respond(
          { settlementId: settlement.id, action: 'reject' },
          { onSuccess: () => navigation.goBack() },
        );
      },
    });
  };

  const handleCancel = () => {
    if (!settlement) return;
    showModal({
      title: 'Cancel Settlement',
      body: 'Cancel this settlement request? The payment will not be recorded.',
      confirmLabel: 'Cancel Settlement',
      variant: 'danger',
      onConfirm: () => {
        cancel(settlement.id, { onSuccess: () => navigation.goBack() });
      },
    });
  };

  if (isLoading) {
    return (
      <Screen scrollable={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!settlement) {
    return (
      <Screen scrollable={false}>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>Settlement not found.</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="outline" />
        </View>
      </Screen>
    );
  }

  const otherUser = isInitiator ? settlement.toUser : settlement.fromUser;

  return (
    <Screen>
      <View style={styles.container}>
        {/* Status Banner */}
        <StatusBanner status={settlement.status} />

        {/* Amount Hero */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>
            {isInitiator ? 'You sent' : 'You received'}
          </Text>
          <Text style={[
            styles.amountValue,
            isInitiator ? styles.amountOut : styles.amountIn,
          ]}>
            {settlement.currency} {settlement.amount.toFixed(2)}
          </Text>
          <Text style={styles.amountDate}>
            {formatDate(settlement.initiatedAt)}
          </Text>
        </View>

        {/* Parties */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parties</Text>

          <UserRow
            label="From"
            name={settlement.fromUser.name}
            email={settlement.fromUser.email}
            highlight={!isInitiator}
          />
          <View style={styles.arrowRow}>
            <MaterialIcons name="arrow-downward" size={20} color={Colors.textTertiary} />
          </View>
          <UserRow
            label="To"
            name={settlement.toUser.name}
            email={settlement.toUser.email}
            highlight={isInitiator}
          />
        </View>

        {/* Note */}
        {settlement.note ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Note</Text>
            <Text style={styles.note}>{settlement.note}</Text>
          </View>
        ) : null}

        {/* Timestamps */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <TimelineRow label="Initiated" date={settlement.initiatedAt} />
          {settlement.confirmedAt && (
            <TimelineRow label="Confirmed" date={settlement.confirmedAt} color={Colors.success} />
          )}
          {settlement.rejectedAt && (
            <TimelineRow label="Rejected" date={settlement.rejectedAt} color={Colors.danger} />
          )}
        </View>

        {/* Actions */}
        {settlement.status === 'pending' && (
          <View style={styles.actionsCard}>
            {isRecipient && (
              <>
                <Button
                  title={responding ? 'Processing...' : 'Confirm Receipt'}
                  onPress={handleConfirm}
                  fullWidth
                  loading={responding}
                  leftIcon={
                    !responding ? (
                      <MaterialIcons name="check-circle" size={18} color={Colors.white} />
                    ) : undefined
                  }
                />
                <Button
                  title="Reject"
                  onPress={handleReject}
                  variant="outline"
                  fullWidth
                  disabled={responding}
                  style={styles.rejectBtn}
                />
              </>
            )}
            {isInitiator && (
              <Button
                title={cancelling ? 'Cancelling...' : 'Cancel Settlement'}
                onPress={handleCancel}
                variant="outline"
                fullWidth
                loading={cancelling}
                style={styles.cancelBtn}
              />
            )}
          </View>
        )}
      </View>
    </Screen>
  );
};

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const StatusBanner: React.FC<{ status: SettlementStatus }> = ({ status }) => {
  const config: Record<SettlementStatus, { color: string; bg: string; icon: string; label: string }> = {
    pending: { color: Colors.warning, bg: Colors.warning + '15', icon: 'hourglass-empty', label: 'Awaiting Confirmation' },
    confirmed: { color: Colors.success, bg: Colors.success + '15', icon: 'check-circle', label: 'Confirmed' },
    rejected: { color: Colors.danger, bg: Colors.danger + '15', icon: 'cancel', label: 'Rejected' },
  };
  const c = config[status];
  return (
    <View style={[bannerStyles.banner, { backgroundColor: c.bg }]}>
      <MaterialIcons name={c.icon as any} size={20} color={c.color} />
      <Text style={[bannerStyles.label, { color: c.color }]}>{c.label}</Text>
    </View>
  );
};

const UserRow: React.FC<{
  label: string;
  name: string;
  email: string;
  highlight?: boolean;
}> = ({ label, name, email, highlight }) => (
  <View style={userRowStyles.row}>
    <View style={[userRowStyles.avatar, highlight && userRowStyles.avatarHighlight]}>
      <Text style={[userRowStyles.avatarText, highlight && userRowStyles.avatarTextHighlight]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
    <View style={userRowStyles.info}>
      <Text style={userRowStyles.label}>{label}</Text>
      <Text style={userRowStyles.name}>{name}</Text>
      <Text style={userRowStyles.email}>{email}</Text>
    </View>
  </View>
);

const TimelineRow: React.FC<{
  label: string;
  date: string;
  color?: string;
}> = ({ label, date, color = Colors.textTertiary }) => (
  <View style={timelineStyles.row}>
    <View style={[timelineStyles.dot, { backgroundColor: color }]} />
    <Text style={timelineStyles.label}>{label}</Text>
    <Text style={timelineStyles.date}>{formatDate(date)}</Text>
  </View>
);

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  container: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xl * 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.base, padding: Spacing.xl },
  errorText: { fontSize: Typography.base, color: Colors.textSecondary },
  amountCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  amountLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  amountValue: { fontSize: 40, fontWeight: Typography.bold },
  amountIn: { color: Colors.success },
  amountOut: { color: Colors.danger },
  amountDate: { fontSize: Typography.xs, color: Colors.textTertiary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  arrowRow: { alignItems: 'center' },
  note: { fontSize: Typography.base, color: Colors.textPrimary, lineHeight: 22 },
  actionsCard: { gap: Spacing.sm },
  rejectBtn: { borderColor: Colors.danger },
  cancelBtn: { borderColor: Colors.danger },
});

const bannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
  },
  label: { fontSize: Typography.sm, fontWeight: Typography.semibold },
});

const userRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHighlight: { backgroundColor: Colors.primary + '20' },
  avatarText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textSecondary },
  avatarTextHighlight: { color: Colors.primary },
  info: { flex: 1 },
  label: { fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  email: { fontSize: Typography.xs, color: Colors.textSecondary },
});

const timelineStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },
  date: { fontSize: Typography.xs, color: Colors.textTertiary },
});

export default SettlementDetailScreen;


