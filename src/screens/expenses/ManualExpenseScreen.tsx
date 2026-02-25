/**
 * Manual Expense Screen â€” full form for creating an expense manually
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { ExpensesStackParamList } from '../../types/navigation';
import { useCreateExpense } from '../../hooks/useExpenses';
import { useFriends } from '../../hooks/useFriends';
import { useGroups } from '../../hooks/useGroups';
import { useCurrentUser } from '../../hooks/useAuth';
import {
  SplitType,
  ExpenseCategory,
  CreateExpensePayload,
  User,
} from '../../types';
import { EXPENSE_CATEGORIES, SPLIT_TYPES, DEFAULT_CURRENCY } from '../../constants';
import { calculateSplit } from '../../utils/splitEngine';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ManualExpense'>;

const ManualExpenseScreen: React.FC<Props> = ({ route, navigation }) => {
  const { groupId, receiptId } = route.params ?? {};
  const user = useCurrentUser();
  const { data: friends = [] } = useFriends();
  const { data: groups = [] } = useGroups();
  const { mutate: createExpense, isPending } = useCreateExpense();

  // Form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [paidById, setPaidById] = useState(user?.id ?? '');
  const [selectedGroupId, setSelectedGroupId] = useState(groupId ?? '');
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(user?.id ? [user.id] : []),
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});

  // Picker modals
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [showPaidByPicker, setShowPaidByPicker] = useState(false);

  // Available users: current user + friends
  const availableUsers: User[] = useMemo(() => {
    const users: User[] = [];
    if (user) users.push(user);
    friends.forEach((f) => {
      if (!users.find((u) => u.id === f.friendId)) {
        users.push(f.friendUser);
      }
    });
    return users;
  }, [user, friends]);

  const participants = availableUsers.filter((u) => participantIds.has(u.id));

  const toggleParticipant = (userId: string) => {
    if (userId === user?.id) return; // current user always included
    setParticipantIds((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const paidByUser = availableUsers.find((u) => u.id === paidById) ?? user;

  const selectedCategory = EXPENSE_CATEGORIES.find((c) => c.id === category);
  const selectedSplitType = SPLIT_TYPES.find((s) => s.id === splitType);

  // Compute splits for preview
  const splitPreview = useMemo(() => {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0 || participants.length === 0) return null;
    const paidBy = paidById || user?.id || '';

    if (splitType === 'equal') {
      return calculateSplit({
        type: 'equal',
        total: numAmount,
        participants: participants.map((p) => ({ userId: p.id, user: p })),
        paidBy,
      });
    }

    if (splitType === 'custom') {
      return calculateSplit({
        type: 'custom',
        total: numAmount,
        assignments: participants.map((p) => ({
          userId: p.id,
          user: p,
          amount: parseFloat(customAmounts[p.id] || '0') || 0,
        })),
        paidBy,
      });
    }

    if (splitType === 'percentage') {
      return calculateSplit({
        type: 'percentage',
        total: numAmount,
        assignments: participants.map((p) => ({
          userId: p.id,
          user: p,
          percentage: parseFloat(percentages[p.id] || '0') || 0,
        })),
        paidBy,
      });
    }

    return null;
  }, [amount, splitType, participants, customAmounts, percentages, paidById, user]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    if (!splitPreview?.isValid) return;

    const payload: CreateExpensePayload = {
      title: title.trim(),
      amount: numAmount,
      category,
      paidBy: paidById,
      splitType,
      splits: splitPreview.splits.map((s) => ({
        userId: s.userId,
        amount: s.amount,
        percentage: s.percentage,
      })),
      groupId: selectedGroupId || undefined,
      receiptId,
      currency: DEFAULT_CURRENCY,
    };

    createExpense(payload, { onSuccess: () => navigation.goBack() });
  };

  return (
    <Screen scrollable contentStyle={styles.container}>
      {/* Title */}
      <Input
        label="What was this for?"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Dinner at Olive Garden"
        required
        leftIcon={<MaterialIcons name="title" size={18} color={Colors.gray400} />}
      />

      {/* Amount */}
      <Input
        label="Total Amount"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
        required
        leftIcon={<Text style={styles.currencySymbol}>$</Text>}
      />

      {/* Category Picker */}
      <Text style={styles.label}>Category</Text>
      <TouchableOpacity
        style={styles.picker}
        onPress={() => setShowCategoryPicker(true)}
      >
        <MaterialIcons
          name={selectedCategory?.icon as keyof typeof MaterialIcons.glyphMap ?? 'receipt'}
          size={20}
          color={Colors.primary}
        />
        <Text style={styles.pickerText}>{selectedCategory?.label ?? 'Select'}</Text>
        <MaterialIcons name="expand-more" size={20} color={Colors.gray400} />
      </TouchableOpacity>

      {/* Paid By */}
      <Text style={styles.label}>Paid By</Text>
      <TouchableOpacity
        style={styles.picker}
        onPress={() => setShowPaidByPicker(true)}
      >
        <Avatar name={paidByUser?.name ?? 'Me'} size="xs" />
        <Text style={styles.pickerText}>
          {paidByUser?.id === user?.id ? 'You' : paidByUser?.name ?? 'Select'}
        </Text>
        <MaterialIcons name="expand-more" size={20} color={Colors.gray400} />
      </TouchableOpacity>

      {/* Participants */}
      <Text style={styles.label}>Split Between</Text>
      <View style={styles.participantsRow}>
        {availableUsers.map((u) => {
          const selected = participantIds.has(u.id);
          const isMe = u.id === user?.id;
          return (
            <TouchableOpacity
              key={u.id}
              style={[styles.participantChip, selected && styles.participantChipSelected]}
              onPress={() => toggleParticipant(u.id)}
            >
              <Avatar name={u.name} size="xs" />
              <Text
                style={[
                  styles.participantName,
                  selected && styles.participantNameSelected,
                ]}
              >
                {isMe ? 'You' : u.name.split(' ')[0]}
              </Text>
              {selected && (
                <MaterialIcons name="check" size={12} color={Colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Split Type */}
      <Text style={styles.label}>Split Type</Text>
      <TouchableOpacity
        style={styles.picker}
        onPress={() => setShowSplitPicker(true)}
      >
        <MaterialIcons
          name={selectedSplitType?.icon as keyof typeof MaterialIcons.glyphMap ?? 'call-split'}
          size={20}
          color={Colors.primary}
        />
        <Text style={styles.pickerText}>{selectedSplitType?.label ?? 'Equal'}</Text>
        <MaterialIcons name="expand-more" size={20} color={Colors.gray400} />
      </TouchableOpacity>

      {/* Custom/Percentage inputs */}
      {splitType === 'custom' && participants.length > 0 && (
        <View style={styles.customSplits}>
          {participants.map((p) => (
            <View key={p.id} style={styles.customSplitRow}>
              <Avatar name={p.name} size="xs" />
              <Text style={styles.customSplitName}>
                {p.id === user?.id ? 'You' : p.name.split(' ')[0]}
              </Text>
              <View style={styles.customSplitInput}>
                <Input
                  value={customAmounts[p.id] ?? ''}
                  onChangeText={(v) => setCustomAmounts((prev) => ({ ...prev, [p.id]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  leftIcon={<Text style={styles.currencySymbol}>$</Text>}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {splitType === 'percentage' && participants.length > 0 && (
        <View style={styles.customSplits}>
          {participants.map((p) => (
            <View key={p.id} style={styles.customSplitRow}>
              <Avatar name={p.name} size="xs" />
              <Text style={styles.customSplitName}>
                {p.id === user?.id ? 'You' : p.name.split(' ')[0]}
              </Text>
              <View style={styles.customSplitInput}>
                <Input
                  value={percentages[p.id] ?? ''}
                  onChangeText={(v) => setPercentages((prev) => ({ ...prev, [p.id]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  rightIcon={<Text style={styles.pctSymbol}>%</Text>}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Split Preview */}
      {splitPreview && (
        <View style={styles.splitPreview}>
          <Text style={styles.splitPreviewTitle}>Split Preview</Text>
          {splitPreview.isValid ? (
            splitPreview.splits.map((s) => {
              const u = availableUsers.find((au) => au.id === s.userId);
              return (
                <View key={s.userId} style={styles.splitPreviewRow}>
                  <Text style={styles.splitPreviewName}>
                    {s.userId === user?.id ? 'You' : u?.name ?? s.userId}
                  </Text>
                  <Text style={styles.splitPreviewAmount}>{formatCurrency(s.amount)}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.splitError}>{splitPreview.error ?? 'Invalid split'}</Text>
          )}
        </View>
      )}

      <Button
        title="Add Expense"
        onPress={handleSubmit}
        loading={isPending}
        fullWidth
        size="lg"
        disabled={!title.trim() || !amount || !splitPreview?.isValid}
        style={styles.submitBtn}
      />

      {/* Category Picker Modal */}
      <PickerModal
        visible={showCategoryPicker}
        title="Select Category"
        onClose={() => setShowCategoryPicker(false)}
        items={EXPENSE_CATEGORIES.map((c) => ({
          id: c.id,
          label: c.label,
          icon: c.icon,
        }))}
        selectedId={category}
        onSelect={(id) => { setCategory(id as ExpenseCategory); setShowCategoryPicker(false); }}
      />

      {/* Split Type Picker Modal */}
      <PickerModal
        visible={showSplitPicker}
        title="Split Type"
        onClose={() => setShowSplitPicker(false)}
        items={SPLIT_TYPES.map((s) => ({
          id: s.id,
          label: s.label,
          icon: s.icon,
          description: s.description,
        }))}
        selectedId={splitType}
        onSelect={(id) => { setSplitType(id as SplitType); setShowSplitPicker(false); }}
      />

      {/* Paid By Picker Modal */}
      <Modal visible={showPaidByPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Who paid?</Text>
            {availableUsers.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.modalItem}
                onPress={() => { setPaidById(u.id); setShowPaidByPicker(false); }}
              >
                <Avatar name={u.name} size="sm" />
                <Text style={styles.modalItemText}>
                  {u.id === user?.id ? `You (${u.name})` : u.name}
                </Text>
                {u.id === paidById && (
                  <MaterialIcons name="check" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <Button title="Cancel" variant="ghost" onPress={() => setShowPaidByPicker(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

// Picker Modal Component
interface PickerItem {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const PickerModal: React.FC<PickerModalProps> = ({
  visible, title, items, selectedId, onSelect, onClose,
}) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        <Text style={styles.modalTitle}>{title}</Text>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => onSelect(item.id)}
            >
              {item.icon && (
                <MaterialIcons
                  name={item.icon as keyof typeof MaterialIcons.glyphMap}
                  size={20}
                  color={Colors.primary}
                />
              )}
              <View style={styles.modalItemContent}>
                <Text style={styles.modalItemText}>{item.label}</Text>
                {item.description && (
                  <Text style={styles.modalItemDesc}>{item.description}</Text>
                )}
              </View>
              {item.id === selectedId && (
                <MaterialIcons name="check" size={18} color={Colors.primary} />
              )}
            </TouchableOpacity>
          )}
        />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: { padding: Spacing.base, gap: Spacing.sm },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pickerText: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  currencySymbol: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
  },
  pctSymbol: { fontSize: Typography.sm, color: Colors.textSecondary },
  participantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  participantChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  participantName: { fontSize: Typography.xs, color: Colors.textSecondary },
  participantNameSelected: { color: Colors.primary, fontWeight: Typography.medium },
  customSplits: { gap: Spacing.xs, marginBottom: Spacing.sm },
  customSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customSplitName: { width: 60, fontSize: Typography.sm, color: Colors.textPrimary },
  customSplitInput: { flex: 1 },
  splitPreview: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  splitPreviewTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  splitPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  splitPreviewName: { fontSize: Typography.sm, color: Colors.textPrimary },
  splitPreviewAmount: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.primary },
  splitError: { fontSize: Typography.sm, color: Colors.danger },
  submitBtn: { marginTop: Spacing.base },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.base,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  modalItemContent: { flex: 1 },
  modalItemText: { fontSize: Typography.base, color: Colors.textPrimary },
  modalItemDesc: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 1 },
});

export default ManualExpenseScreen;

