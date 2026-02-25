/**
 * Initiate Settlement Screen â€” send a payment to another user
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { SettlementsStackParamList } from '../../types/navigation';
import { useCreateSettlement } from '../../hooks/useSettlements';
import { useFriends } from '../../hooks/useFriends';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<SettlementsStackParamList, 'InitiateSettlement'>;

const InitiateSettlementScreen: React.FC<Props> = ({ route, navigation }) => {
  const { toUserId, suggestedAmount, groupId } = route.params;
  const { data: friendsData } = useFriends();
  const { mutate: createSettlement, isPending } = useCreateSettlement();

  const toUser = friendsData?.find((f) => f.friendUser.id === toUserId)?.friendUser;

  const [amount, setAmount] = useState(
    suggestedAmount ? suggestedAmount.toFixed(2) : '',
  );
  const [note, setNote] = useState('');
  const [currency] = useState('USD');

  const parsedAmount = parseFloat(amount);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    createSettlement(
      {
        toUserId,
        amount: parsedAmount,
        currency,
        note: note.trim() || undefined,
        groupId,
      },
      {
        onSuccess: () => {
          navigation.goBack();
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen scrollable={false}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* To User Card */}
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {(toUser?.name ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userLabel}>Settling with</Text>
              <Text style={styles.userName}>{toUser?.name ?? 'Unknown User'}</Text>
              <Text style={styles.userEmail}>{toUser?.email ?? ''}</Text>
            </View>
            <MaterialIcons name="check-circle" size={28} color={Colors.success} />
          </View>

          {/* Amount Input */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                autoFocus={!suggestedAmount}
              />
              <Text style={styles.currencyCode}>{currency}</Text>
            </View>
            {suggestedAmount && (
              <Text style={styles.suggestedHint}>
                Suggested based on shared expenses
              </Text>
            )}
          </View>

          {/* Note */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Dinner split, electricity bill..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <MaterialIcons name="compare-arrows" size={20} color={Colors.primary} />
              <Text style={styles.summaryText}>
                You are sending{' '}
                <Text style={styles.summaryBold}>
                  {currency} {isValid ? parsedAmount.toFixed(2) : 'â€”'}
                </Text>{' '}
                to{' '}
                <Text style={styles.summaryBold}>{toUser?.name ?? 'this person'}</Text>
              </Text>
            </View>
            <Text style={styles.summaryMeta}>
              They will need to confirm the payment before it's marked as settled.
            </Text>
          </View>

          <Button
            title={isPending ? 'Sending...' : 'Send Settlement'}
            onPress={handleSubmit}
            loading={isPending}
            disabled={!isValid}
            fullWidth
            size="lg"
            leftIcon={
              !isPending ? (
                <MaterialIcons name="send" size={18} color={Colors.white} />
              ) : undefined
            }
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.base,
    gap: Spacing.base,
    paddingBottom: Spacing.xl * 2,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  userInfo: { flex: 1 },
  userLabel: { fontSize: Typography.xs, color: Colors.textTertiary },
  userName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  userEmail: { fontSize: Typography.xs, color: Colors.textSecondary },
  amountCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.xs,
    alignItems: 'center',
    ...Shadows.sm,
  },
  amountLabel: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  currencySymbol: {
    fontSize: 36,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
  },
  amountInput: {
    fontSize: 52,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    minWidth: 120,
    textAlign: 'center',
  },
  currencyCode: { fontSize: Typography.base, color: Colors.textTertiary },
  suggestedHint: { fontSize: Typography.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  field: { gap: Spacing.xs },
  fieldLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.base,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  summaryText: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, lineHeight: 20 },
  summaryBold: { fontWeight: Typography.bold },
  summaryMeta: { fontSize: Typography.xs, color: Colors.textSecondary, lineHeight: 18 },
});

export default InitiateSettlementScreen;


