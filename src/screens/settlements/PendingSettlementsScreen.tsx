/**
 * Pending Settlements Screen â€” settlements awaiting action
 * Two sections: "Waiting for you" (received) and "Waiting on them" (sent)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { SettlementsStackParamList } from '../../types/navigation';
import { Settlement } from '../../types';
import {
  usePendingSettlements,
  useRespondToSettlement,
} from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { useShowModal } from '../../store/uiStore';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<SettlementsStackParamList, 'PendingSettlements'>;

const PendingSettlementsScreen: React.FC<Props> = ({ navigation }) => {
  const currentUser = useCurrentUser();
  const { data: settlements, isLoading, refetch, isRefetching } = usePendingSettlements();
  const { mutate: respond, isPending: responding } = useRespondToSettlement();
  const showModal = useShowModal();

  // Split into two groups
  const awaitingMyAction =
    settlements?.filter((s) => s.toUserId === currentUser?.id && s.status === 'pending') ?? [];
  const waitingOnThem =
    settlements?.filter((s) => s.fromUserId === currentUser?.id && s.status === 'pending') ?? [];

  const handleConfirm = (settlement: Settlement) => {
    showModal({
      title: 'Confirm Settlement',
      body: `Confirm that you received ${settlement.currency} ${settlement.amount.toFixed(2)} from ${settlement.fromUser.name}?`,
      confirmLabel: 'Confirm',
      cancelLabel: 'Not Yet',
      onConfirm: () => {
        respond({ settlementId: settlement.id, action: 'confirm' });
      },
    });
  };

  const handleReject = (settlement: Settlement) => {
    showModal({
      title: 'Reject Settlement',
      body: `Reject the settlement of ${settlement.currency} ${settlement.amount.toFixed(2)} from ${settlement.fromUser.name}?`,
      confirmLabel: 'Reject',
      cancelLabel: 'Keep Pending',
      variant: 'danger',
      onConfirm: () => {
        respond({ settlementId: settlement.id, action: 'reject' });
      },
    });
  };

  const renderReceived = ({ item }: { item: Settlement }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.fromUser.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardName}>{item.fromUser.name}</Text>
          <Text style={styles.cardMeta}>
            sent you{' '}
            <Text style={styles.amountText}>
              {item.currency} {item.amount.toFixed(2)}
            </Text>
          </Text>
          {item.note ? <Text style={styles.note} numberOfLines={1}>{item.note}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          title="Reject"
          onPress={() => handleReject(item)}
          variant="outline"
          size="sm"
          style={styles.rejectBtn}
          disabled={responding}
        />
        <Button
          title="Confirm"
          onPress={() => handleConfirm(item)}
          size="sm"
          style={styles.confirmBtn}
          disabled={responding}
        />
      </View>
    </View>
  );

  const renderSent = ({ item }: { item: Settlement }) => (
    <TouchableOpacity
      style={[styles.card, styles.sentCard]}
      onPress={() => navigation.navigate('SettlementDetail', { settlementId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, styles.avatarOut]}>
          <Text style={[styles.avatarText, styles.avatarTextOut]}>
            {item.toUser.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardName}>{item.toUser.name}</Text>
          <Text style={styles.cardMeta}>
            Waiting for them to confirm{' '}
            <Text style={styles.amountTextOut}>
              {item.currency} {item.amount.toFixed(2)}
            </Text>
          </Text>
          {item.note ? <Text style={styles.note} numberOfLines={1}>{item.note}</Text> : null}
        </View>
        <MaterialIcons name="schedule" size={20} color={Colors.warning} />
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <Screen scrollable={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </Screen>
    );
  }

  const hasNoPending = awaitingMyAction.length === 0 && waitingOnThem.length === 0;

  return (
    <Screen>
      <View style={styles.container}>
        {hasNoPending ? (
          <View style={styles.empty}>
            <MaterialIcons name="check-circle-outline" size={56} color={Colors.success} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyMeta}>No pending settlements at the moment</Text>
          </View>
        ) : (
          <>
            {/* Awaiting my action */}
            {awaitingMyAction.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                  <Text style={styles.sectionTitle}>
                    Waiting for you ({awaitingMyAction.length})
                  </Text>
                </View>
                {awaitingMyAction.map((s) => (
                  <View key={s.id}>{renderReceived({ item: s })}</View>
                ))}
              </View>
            )}

            {/* Waiting on them */}
            {waitingOnThem.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.sectionTitle}>
                    Waiting on them ({waitingOnThem.length})
                  </Text>
                </View>
                {waitingOnThem.map((s) => (
                  <View key={s.id}>{renderSent({ item: s })}</View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.base, gap: Spacing.base },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl * 3,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  emptyMeta: { fontSize: Typography.sm, color: Colors.textSecondary },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  sentCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOut: { backgroundColor: Colors.primary + '20' },
  avatarText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.success,
  },
  avatarTextOut: { color: Colors.primary },
  cardContent: { flex: 1, gap: 2 },
  cardName: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  cardMeta: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  amountText: { fontWeight: Typography.bold, color: Colors.success },
  amountTextOut: { fontWeight: Typography.bold, color: Colors.primary },
  note: { fontSize: Typography.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  rejectBtn: { flex: 1 },
  confirmBtn: { flex: 1 },
});

export default PendingSettlementsScreen;


