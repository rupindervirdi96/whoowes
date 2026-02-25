/**
 * Receipt Review Screen â€” edit AI-parsed items, assign to people, create expense
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { ExpensesStackParamList } from '../../types/navigation';
import { ReceiptItem, ParsedReceipt } from '../../types';
import { useReceipt, useApplyAIPrompt, useUpdateReceiptData } from '../../hooks/useReceipts';
import { useCreateExpense } from '../../hooks/useExpenses';
import { useFriends } from '../../hooks/useFriends';
import { useCurrentUser } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ReceiptReview'>;

const ReceiptReviewScreen: React.FC<Props> = ({ route, navigation }) => {
  const { receiptId, groupId } = route.params;
  const currentUser = useCurrentUser();

  const { data: receipt, isLoading } = useReceipt(receiptId);
  const { mutate: applyPrompt, isPending: applyingPrompt } = useApplyAIPrompt();
  const { mutate: updateReceiptData, isPending: savingEdits } = useUpdateReceiptData();
  const { mutate: createExpense, isPending: creatingExpense } = useCreateExpense();
  const { data: friendsData } = useFriends();

  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  const [tax, setTax] = useState('0');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // All people who can be assigned items (current user + friends)
  const participants = [
    ...(currentUser ? [currentUser] : []),
    ...(friendsData?.map((f) => f.friendUser) ?? []),
  ];

  useEffect(() => {
    if (receipt?.parsedData) {
      const pd = receipt.parsedData;
      setItems(pd.items.map((item) => ({ ...item })));
      setMerchant(pd.merchant);
      setDate(pd.date ?? '');
      setTax(String(pd.tax ?? 0));
    }
  }, [receipt]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalWithTax = total + parseFloat(tax || '0');

  const updateItemField = <K extends keyof ReceiptItem>(
    idx: number,
    field: K,
    value: ReceiptItem[K],
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    setIsDirty(true);
  };

  const toggleAssignee = (itemIdx: number, userId: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[itemIdx];
      const assigned = item.assignedTo.includes(userId)
        ? item.assignedTo.filter((id) => id !== userId)
        : [...item.assignedTo, userId];
      updated[itemIdx] = { ...item, assignedTo: assigned };
      return updated;
    });
    setIsDirty(true);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: '',
        price: 0,
        quantity: 1,
        assignedTo: currentUser ? [currentUser.id] : [],
      },
    ]);
    setIsDirty(true);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handleApplyPrompt = () => {
    if (!aiPrompt.trim()) return;
    applyPrompt(
      { receiptId, prompt: aiPrompt.trim() },
      {
        onSuccess: () => {
          setAiPrompt('');
          setIsDirty(false);
        },
      },
    );
  };

  const handleSaveEdits = () => {
    if (!receipt?.parsedData) return;
    const updatedParsedData: ParsedReceipt = {
      ...receipt.parsedData,
      merchant,
      date: date || undefined,
      items,
      tax: parseFloat(tax || '0'),
      total: totalWithTax,
      subtotal: total,
    };
    updateReceiptData({ receiptId, parsedData: updatedParsedData });
    setIsDirty(false);
  };

  const handleCreateExpense = () => {
    if (!currentUser) return;

    // Build split from item assignments
    const participantMap = new Map<string, number>();
    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      if (item.assignedTo.length === 0) {
        // Unassigned item: split equally
        const share = itemTotal / participants.length;
        participants.forEach((p) => {
          participantMap.set(p.id, (participantMap.get(p.id) ?? 0) + share);
        });
      } else {
        const share = itemTotal / item.assignedTo.length;
        item.assignedTo.forEach((uid) => {
          participantMap.set(uid, (participantMap.get(uid) ?? 0) + share);
        });
      }
    }

    // Add tax proportionally
    if (parseFloat(tax) > 0 && total > 0) {
      const taxAmount = parseFloat(tax);
      participantMap.forEach((amount, uid) => {
        participantMap.set(uid, amount + (amount / total) * taxAmount);
      });
    }

    const splitParticipants = participants
      .filter((p) => participantMap.has(p.id))
      .map((p) => ({
        userId: p.id,
        user: p,
        amount: parseFloat((participantMap.get(p.id) ?? 0).toFixed(2)),
      }));

    createExpense(
      {
        title: merchant || 'Receipt Expense',
        amount: totalWithTax,
        currency: receipt?.parsedData?.currency ?? 'USD',
        category: 'food',
        paidBy: currentUser.id,
        splitType: 'custom',
        splits: splitParticipants.map(({ userId, amount }) => ({ userId, amount })),
        receiptId,
        groupId,
      },
      {
        onSuccess: (expense) => {
          navigation.replace('ExpenseDetail', { expenseId: expense.id });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Screen scrollable={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </Screen>
    );
  }

  if (!receipt?.parsedData) {
    return (
      <Screen scrollable={false}>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>Could not load parsed receipt data.</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="outline" />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen>
        <View style={styles.container}>
          {/* â”€â”€ AI Prompt Re-analyze â”€â”€ */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="auto-awesome" size={16} color={Colors.primary} /> AI Re-analyze
            </Text>
            <Text style={styles.sectionMeta}>
              Describe corrections or ask AI to adjust the parsed data
            </Text>
            <View style={styles.promptRow}>
              <TextInput
                style={styles.promptInput}
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder='e.g. "Remove the 5% service charge item"'
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
              <TouchableOpacity
                style={[styles.promptBtn, applyingPrompt && styles.disabled]}
                onPress={handleApplyPrompt}
                disabled={applyingPrompt || !aiPrompt.trim()}
              >
                {applyingPrompt ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <MaterialIcons name="send" size={18} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* â”€â”€ Receipt Header â”€â”€ */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Receipt Details</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Merchant</Text>
              <TextInput
                style={styles.fieldInput}
                value={merchant}
                onChangeText={(v) => { setMerchant(v); setIsDirty(true); }}
                placeholder="Merchant name"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.fieldInput}
                value={date}
                onChangeText={(v) => { setDate(v); setIsDirty(true); }}
                placeholder="e.g. 2024-01-15"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Tax</Text>
              <TextInput
                style={styles.fieldInput}
                value={tax}
                onChangeText={(v) => { setTax(v); setIsDirty(true); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          {/* â”€â”€ Items â”€â”€ */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Items ({items.length})</Text>
              <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
                <MaterialIcons name="add" size={18} color={Colors.primary} />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {items.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                participants={participants}
                onChangeName={(v) => updateItemField(idx, 'name', v)}
                onChangePrice={(v) => updateItemField(idx, 'price', parseFloat(v) || 0)}
                onChangeQty={(v) => updateItemField(idx, 'quantity', parseInt(v) || 1)}
                onToggleAssignee={(uid) => toggleAssignee(idx, uid)}
                onRemove={() => removeItem(idx)}
              />
            ))}

            {/* Totals */}
            <View style={styles.totalsBlock}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>${parseFloat(tax || '0').toFixed(2)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>${totalWithTax.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* â”€â”€ Actions â”€â”€ */}
          {isDirty && (
            <Button
              title={savingEdits ? 'Saving...' : 'Save Edits'}
              onPress={handleSaveEdits}
              variant="outline"
              fullWidth
              loading={savingEdits}
              style={styles.saveBtn}
            />
          )}

          <Button
            title={creatingExpense ? 'Creating Expense...' : 'Create Expense'}
            onPress={handleCreateExpense}
            fullWidth
            size="lg"
            loading={creatingExpense}
            leftIcon={
              !creatingExpense ? (
                <MaterialIcons name="check-circle" size={18} color={Colors.white} />
              ) : undefined
            }
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
};

// â”€â”€ Item Row Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ItemRowProps {
  item: ReceiptItem;
  participants: Array<{ id: string; name: string; avatarUrl?: string }>;
  onChangeName: (v: string) => void;
  onChangePrice: (v: string) => void;
  onChangeQty: (v: string) => void;
  onToggleAssignee: (uid: string) => void;
  onRemove: () => void;
}

const ItemRow: React.FC<ItemRowProps> = ({
  item,
  participants,
  onChangeName,
  onChangePrice,
  onChangeQty,
  onToggleAssignee,
  onRemove,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={itemStyles.container}>
      <View style={itemStyles.header}>
        <TextInput
          style={itemStyles.nameInput}
          value={item.name}
          onChangeText={onChangeName}
          placeholder="Item name"
          placeholderTextColor={Colors.textTertiary}
        />
        <TouchableOpacity onPress={onRemove} style={itemStyles.removeBtn}>
          <MaterialIcons name="delete-outline" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <View style={itemStyles.numbersRow}>
        <View style={itemStyles.numField}>
          <Text style={itemStyles.numLabel}>Price</Text>
          <TextInput
            style={itemStyles.numInput}
            value={item.price === 0 ? '' : String(item.price)}
            onChangeText={onChangePrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>
        <Text style={itemStyles.times}>Ã—</Text>
        <View style={itemStyles.numField}>
          <Text style={itemStyles.numLabel}>Qty</Text>
          <TextInput
            style={itemStyles.numInput}
            value={String(item.quantity)}
            onChangeText={onChangeQty}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>
        <Text style={itemStyles.subtotal}>${(item.price * item.quantity).toFixed(2)}</Text>
      </View>

      {/* Assignees toggle */}
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        style={itemStyles.assignRow}
      >
        <Text style={itemStyles.assignLabel}>
          {item.assignedTo.length === 0
            ? 'Split equally'
            : `${item.assignedTo.length} assigned`}
        </Text>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={itemStyles.assigneeList}>
          {participants.map((p) => {
            const assigned = item.assignedTo.includes(p.id);
            return (
              <TouchableOpacity
                key={p.id}
                style={itemStyles.assigneeRow}
                onPress={() => onToggleAssignee(p.id)}
              >
                <View style={[itemStyles.checkbox, assigned && itemStyles.checkboxActive]}>
                  {assigned && (
                    <MaterialIcons name="check" size={14} color={Colors.white} />
                  )}
                </View>
                <Text style={itemStyles.assigneeName}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  container: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xl * 2 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.base,
    padding: Spacing.xl,
  },
  loadingText: { fontSize: Typography.base, color: Colors.textSecondary },
  errorText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  sectionMeta: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  promptRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  promptInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.base,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    minHeight: 44,
  },
  promptBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.base,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fieldLabel: {
    width: 72,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
  fieldInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.base,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
  },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.medium },
  totalsBlock: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  totalValue: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs },
  grandTotalLabel: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  grandTotalValue: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primary },
  saveBtn: { marginBottom: -Spacing.xs },
});

const itemStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.base,
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  nameInput: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 4,
  },
  removeBtn: { padding: 4 },
  numbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  numField: { gap: 2 },
  numLabel: { fontSize: 10, color: Colors.textTertiary },
  numInput: {
    width: 64,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  times: { fontSize: Typography.sm, color: Colors.textTertiary },
  subtotal: {
    flex: 1,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  assignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  assignLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  assigneeList: { gap: 6 },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  assigneeName: { fontSize: Typography.sm, color: Colors.textPrimary },
});

export default ReceiptReviewScreen;


