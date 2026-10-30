import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { ExpenseCategory, ReceiptItem, User } from '../../types';
import { useReceipt, useUpdateReceiptData } from '../../hooks/useReceipts';
import { useCreateExpense } from '../../hooks/useExpenses';
import { useFriends } from '../../hooks/useFriends';
import { useGroup } from '../../hooks/useGroups';
import { useCurrentUser } from '../../hooks/useAuth';
import { useAssignItems } from '../../hooks/useAI';
import { useEntitlements } from '../../hooks/useBilling';
import { splitReceiptItems } from '../../utils/splitEngine';
import { currencyDecimals, formatCurrency, getCurrencySymbol, isKnownCurrency, parseAmount, roundToCents } from '../../utils/currency';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useT } from '../../i18n';
import CurrencyPicker from '../../components/CurrencyPicker';
import { firstName } from '../../utils/money';
import { generateId } from '../../utils/idGenerator';
import { EXPENSE_CATEGORIES } from '../../constants';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';
import Input from '../../components/ui/Input';
import { PlanTag } from '../../components/ui/Badge';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const ReceiptReviewScreen: React.FC<RootScreenProps<'ReceiptReview'>> = ({ route, navigation }) => {
  const { receiptId, groupId } = route.params;
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const { data: receipt, isLoading } = useReceipt(receiptId);
  const { data: friends = [] } = useFriends();
  const { data: group } = useGroup(groupId ?? '');
  const { can } = useEntitlements();
  const assign = useAssignItems();
  const updateReceipt = useUpdateReceiptData();
  const create = useCreateExpense();

  const [merchant, setMerchant] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [tax, setTax] = useState('0');
  const [tip, setTip] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [instruction, setInstruction] = useState('');
  const [activePerson, setActivePerson] = useState<string>(me.id);
  // The receipt's own currency (read by the AI); the user can correct it.
  const [currency, setCurrency] = useState<string>(myCurrency);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  // Everyone who could be on the bill; the user narrows it with chips.
  const everyone: User[] = useMemo(
    () => (group ? group.members.map((m) => m.user) : [me, ...friends.map((f) => f.friendUser)]),
    [group, me, friends],
  );
  const [onBill, setOnBill] = useState<Set<string>>(new Set([me.id]));
  useEffect(() => {
    if (group) setOnBill(new Set(group.members.map((m) => m.userId)));
  }, [group]);
  const people = everyone.filter((p) => onBill.has(p.id));

  useEffect(() => {
    const pd = receipt?.parsedData;
    if (!pd) return;
    setMerchant(pd.merchant);
    setItems(pd.items.map((i) => ({ ...i })));
    setTax(String(pd.tax ?? 0));
    if (pd.tip) setTip(String(pd.tip));
    setCurrency(isKnownCurrency(pd.currency) ? pd.currency : (group?.currency ?? myCurrency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt]);

  const itemsTotal = roundToCents(items.reduce((s, i) => s + i.price * i.quantity, 0));
  const extras = parseAmount(tax) + parseAmount(tip);
  const total = roundToCents(itemsTotal + extras);
  const decimals = currencyDecimals(currency);
  const shares = useMemo(() => splitReceiptItems(items, people.map((p) => p.id), extras, decimals), [items, people, extras, decimals]);
  const unassigned = items.filter((i) => i.assignedTo.length === 0).length;

  const toggleItem = (idx: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const has = item.assignedTo.includes(activePerson);
        return { ...item, assignedTo: has ? item.assignedTo.filter((id) => id !== activePerson) : [...item.assignedTo, activePerson] };
      }),
    );
  };

  const editItem = (idx: number, patch: Partial<ReceiptItem>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const runAssistant = () => {
    if (!instruction.trim()) return;
    if (!can('ai_split_assistant')) {
      navigation.navigate('Plans', { feature: 'ai_split_assistant' });
      return;
    }
    assign.mutate(
      { items, people, instruction: instruction.trim() },
      {
        onSuccess: (next) => {
          setItems(next);
          setInstruction('');
        },
      },
    );
  };

  const save = () => {
    if (!receipt?.parsedData || people.length === 0 || total <= 0) return;
    updateReceipt.mutate({
      receiptId,
      parsedData: { ...receipt.parsedData, merchant, items, tax: parseAmount(tax), tip: parseAmount(tip), subtotal: itemsTotal, total, currency },
    });
    create.mutate(
      {
        title: merchant.trim() || tr('receipt.defaultTitle'),
        amount: total,
        currency,
        category,
        paidBy: me.id,
        splitType: 'item_based',
        splits: people.map((p) => ({ userId: p.id, amount: shares[p.id] ?? 0 })),
        items: items.map(({ id: _id, ...rest }) => rest),
        receiptId,
        groupId,
        date: receipt.parsedData.date ? new Date(receipt.parsedData.date).toISOString() : undefined,
      },
      { onSuccess: (e) => navigation.replace('ExpenseDetail', { expenseId: e.id }) },
    );
  };

  if (isLoading) {
    return (
      <Screen>
        <SkeletonList rows={6} />
      </Screen>
    );
  }
  if (!receipt?.parsedData) {
    return (
      <Screen>
        <EmptyState emoji="🧐" title={tr('receipt.notFound')} body={tr('receipt.scanAgain')} actionLabel={tr('common.goBack')} onAction={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text tone="secondary">
              {tr('expense.youPaid')} · {tr('common.people', { count: people.length })}
            </Text>
            <Text variant="bodyStrong" tabular>
              {formatCurrency(total, currency)}
            </Text>
          </View>
          <Button title={tr('expense.save')} size="lg" fullWidth loading={create.isPending} disabled={people.length === 0 || total <= 0} onPress={save} />
        </View>
      }
    >
      {receipt.parsedData.rawText ? (
        <Card variant="alt" padding={12} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: t.spacing.base }}>
          <Icon name="info-outline" size={18} color={t.colors.warning} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {receipt.parsedData.rawText}
          </Text>
        </Card>
      ) : null}
      <Input label={tr('receipt.merchant')} value={merchant} onChangeText={setMerchant} icon="storefront" />
      <Card padding={4} style={{ paddingHorizontal: 12, marginBottom: t.spacing.base }}>
        <ListRow
          leading={<Icon name="payments" color={t.colors.textSecondary} />}
          title={tr('receipt.currency')}
          subtitle={tr('receipt.currencyHint')}
          trailing={<Text tone="secondary">{currency}</Text>}
          chevron
          onPress={() => setCurrencyOpen(true)}
        />
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0, marginTop: -4 }}>
        {EXPENSE_CATEGORIES.map((c) => (
          <Chip key={c.id} label={`${c.emoji} ${tr(c.shortKey)}`} selected={c.id === category} onPress={() => setCategory(c.id)} />
        ))}
      </ScrollView>

      {/* Who's on the bill */}
      <SectionHeader title={tr('receipt.whosOnBill')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {everyone.map((p) => (
          <Chip
            key={p.id}
            label={p.id === me.id ? tr('common.you') : firstName(p.name)}
            leading={<Avatar name={p.name} size="xs" />}
            selected={onBill.has(p.id)}
            onPress={() =>
              setOnBill((prev) => {
                const next = new Set(prev);
                if (next.has(p.id) && p.id !== me.id) next.delete(p.id);
                else next.add(p.id);
                return next;
              })
            }
          />
        ))}
      </View>

      {/* AI Split Assistant */}
      <Card style={{ marginTop: t.spacing.lg, borderWidth: 1.5, borderColor: t.colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="auto-awesome" size={18} color={t.colors.primary} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {tr('receipt.assistant')}
          </Text>
          {!can('ai_split_assistant') ? <PlanTag plan="pro" /> : null}
        </View>
        <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
          {tr('receipt.assistantBody')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <TextInput
            value={instruction}
            onChangeText={setInstruction}
            placeholder={tr('receipt.assistantPlaceholder', { name: people[1] ? firstName(people[1].name) : 'Sam' })}
            placeholderTextColor={t.colors.textTertiary}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: t.radius.sm,
              backgroundColor: t.colors.surfaceAlt,
              paddingHorizontal: 12,
              fontFamily: t.fonts.medium,
              fontSize: 15,
              color: t.colors.text,
            }}
            accessibilityLabel={tr('receipt.assistantLabel')}
            onSubmitEditing={runAssistant}
          />
          <Button title={tr('receipt.go')} size="sm" loading={assign.isPending} disabled={!instruction.trim()} onPress={runAssistant} style={{ height: 44 }} />
        </View>
      </Card>

      {/* Items */}
      <SectionHeader title={`${tr('receipt.items')} · ${items.length}`} action={tr('receipt.addItem')} onAction={() => setItems((p) => [...p, { id: generateId(), name: '', price: 0, quantity: 1, assignedTo: [] }])} />
      <Text variant="caption" tone="tertiary" style={{ marginBottom: 10 }}>
        {tr('receipt.pickPerson')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0, marginBottom: 12 }}>
        {people.map((p) => (
          <Chip
            key={p.id}
            label={p.id === me.id ? tr('common.you') : firstName(p.name)}
            leading={<Avatar name={p.name} size="xs" />}
            selected={activePerson === p.id}
            onPress={() => setActivePerson(p.id)}
          />
        ))}
      </ScrollView>

      <Card padding={4}>
        {items.map((item, idx) => {
          const mine = item.assignedTo.includes(activePerson);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggleItem(idx)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: mine }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: t.radius.sm,
                backgroundColor: mine ? t.colors.primarySoft : 'transparent',
                borderBottomWidth: idx < items.length - 1 ? 1 : 0,
                borderBottomColor: t.colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <TextInput
                  value={item.name}
                  onChangeText={(v) => editItem(idx, { name: v })}
                  placeholder={tr('receipt.itemName')}
                  placeholderTextColor={t.colors.textTertiary}
                  style={{ fontFamily: t.fonts.semibold, fontSize: 15, color: t.colors.text, paddingVertical: 2 }}
                />
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, minHeight: 20 }}>
                  {item.assignedTo.length === 0 ? (
                    <Text variant="caption" tone="tertiary">
                      {tr('receipt.sharedByEveryone')}
                    </Text>
                  ) : (
                    item.assignedTo.map((id) => {
                      const p = people.find((x) => x.id === id);
                      return p ? <Avatar key={id} name={p.name} size="xs" /> : null;
                    })
                  )}
                </View>
              </View>
              {item.quantity > 1 ? (
                <Text variant="caption" tone="tertiary">
                  ×{item.quantity}
                </Text>
              ) : null}
              <PriceInput value={item.price} onChange={(price) => editItem(idx, { price })} label={tr('receipt.priceOf', { name: item.name })} decimals={decimals} symbol={getCurrencySymbol(currency)} />
              <Pressable onPress={() => setItems((p) => p.filter((_, i) => i !== idx))} hitSlop={8} accessibilityLabel={tr('receipt.remove', { name: item.name })}>
                <Icon name="close" size={18} color={t.colors.textTertiary} />
              </Pressable>
            </Pressable>
          );
        })}
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.base }}>
        <Input label={tr('receipt.tax')} value={tax} onChangeText={setTax} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} />
        <Input label={tr('receipt.tip')} value={tip} onChangeText={setTip} keyboardType="decimal-pad" placeholder="0" containerStyle={{ flex: 1 }} />
      </View>
      {unassigned > 0 ? (
        <Text variant="caption" tone="warning" style={{ marginTop: -6 }}>
          {tr('receipt.unassigned', { count: unassigned })}
        </Text>
      ) : null}

      {/* Per person */}
      <SectionHeader title={tr('receipt.whoOwesWhat')} />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        {people.map((p, i) => (
          <View
            key={p.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              borderBottomWidth: i < people.length - 1 ? 1 : 0,
              borderBottomColor: t.colors.border,
            }}
          >
            <Avatar name={p.name} size="sm" />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {p.id === me.id ? tr('common.you') : p.name}
            </Text>
            <Text variant="bodyStrong" tabular>
              {formatCurrency(shares[p.id] ?? 0, currency)}
            </Text>
          </View>
        ))}
      </Card>
      <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>
        {tr('receipt.taxShared')}
      </Text>

      <CurrencyPicker
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        value={currency}
        suggested={[receipt.parsedData.currency, group?.currency, myCurrency]}
        onSelect={setCurrency}
      />
    </Screen>
  );
};

/** Price field that keeps the user's raw text while typing and shows the currency's decimals otherwise. */
const PriceInput: React.FC<{ value: number; onChange: (v: number) => void; label: string; decimals: number; symbol: string }> = ({
  value,
  onChange,
  label,
  decimals,
  symbol,
}) => {
  const t = useTheme();
  const [text, setText] = useState<string | null>(null);
  return (
    <TextInput
      value={text ?? (value ? value.toFixed(decimals) : '')}
      onFocus={() => setText(value ? String(value) : '')}
      onChangeText={(v) => {
        const clean = v.replace(',', '.').replace(/[^0-9.-]/g, '');
        setText(clean);
        onChange(parseFloat(clean) || 0);
      }}
      onBlur={() => setText(null)}
      keyboardType="decimal-pad"
      placeholder={symbol}
      placeholderTextColor={t.colors.textTertiary}
      style={{ width: 84, textAlign: 'right', fontFamily: t.fonts.bold, fontSize: 15, color: t.colors.text }}
      accessibilityLabel={label}
    />
  );
};

export default ReceiptReviewScreen;
