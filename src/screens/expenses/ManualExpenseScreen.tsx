import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { ExpenseCategory, SplitType, User } from '../../types';
import { useCurrentUser } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { useGroups } from '../../hooks/useGroups';
import { useCreateExpense } from '../../hooks/useExpenses';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useT } from '../../i18n';
import { calculateSplit } from '../../utils/splitEngine';
import { cleanAmountInput, currencyDecimals, formatCurrency, getCurrencySymbol, isKnownCurrency, parseAmount } from '../../utils/currency';
import { firstName } from '../../utils/money';
import { EXPENSE_CATEGORIES, SPLIT_TYPES } from '../../constants';
import Screen from '../../components/ui/Screen';
import AmountInput from '../../components/ui/AmountInput';
import Input from '../../components/ui/Input';
import Text from '../../components/ui/Text';
import Chip, { SegmentedControl } from '../../components/ui/Chip';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import BottomSheet from '../../components/ui/BottomSheet';
import ListRow from '../../components/ui/ListRow';
import { categoryColor } from '../../components/ui/CategoryIcon';
import GroupTile from '../../components/GroupTile';
import CurrencyPicker from '../../components/CurrencyPicker';

const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const ManualExpenseScreen: React.FC<RootScreenProps<'ManualExpense'>> = ({ route, navigation }) => {
  const params = route.params ?? {};
  const draft = params.draft;
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const { data: friends = [] } = useFriends();
  const { data: groups = [] } = useGroups();
  const create = useCreateExpense();

  const initialGroup = groups.find((g) => g.id === (draft?.groupId ?? params.groupId));
  const [currency, setCurrency] = useState<string>(
    isKnownCurrency(draft?.currency) ? draft!.currency : (initialGroup?.currency ?? myCurrency),
  );
  // Once the user picks a currency themselves, choosing a group no longer changes it.
  const [currencyTouched, setCurrencyTouched] = useState(!!draft?.currency);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [amount, setAmount] = useState(draft?.amount ? String(draft.amount) : '');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(draft?.category ?? 'food');
  const [groupId, setGroupId] = useState<string | undefined>(draft?.groupId ?? params.groupId);
  const [paidBy, setPaidBy] = useState(draft?.paidBy ?? me.id);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(draft?.participantIds ?? [me.id, ...(params.friendId ? [params.friendId] : [])]),
  );
  const [splitType, setSplitType] = useState<SplitType>(draft?.splitType ?? 'equal');
  const [custom, setCustom] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(draft?.customAmounts ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [percent, setPercent] = useState<Record<string, string>>({});
  const [dayOffset, setDayOffset] = useState(0);
  const [notes, setNotes] = useState('');
  const [sheet, setSheet] = useState<'group' | 'payer' | null>(null);

  const group = groups.find((g) => g.id === groupId);
  const decimals = currencyDecimals(currency);

  // People who can take part: the group's members, or me + my friends.
  const people: User[] = useMemo(() => {
    if (group) return group.members.map((m) => m.user);
    return [me, ...friends.map((f) => f.friendUser)];
  }, [group, me, friends]);

  // Picking a group puts the whole group on the bill, in the group's currency.
  useEffect(() => {
    if (group && !draft) setParticipantIds(new Set(group.members.map((m) => m.userId)));
    if (!currencyTouched) setCurrency(group?.currency ?? myCurrency);
  }, [group, draft, currencyTouched, myCurrency]);

  const participants = people.filter((p) => participantIds.has(p.id));
  const total = parseAmount(amount);
  const payer = people.find((p) => p.id === paidBy) ?? me;

  const split = useMemo(() => {
    if (total <= 0 || participants.length === 0) return null;
    const base = { total, paidBy, decimals };
    if (splitType === 'custom') {
      return calculateSplit({
        type: 'custom',
        ...base,
        assignments: participants.map((p) => ({ userId: p.id, user: p, amount: parseAmount(custom[p.id] ?? '') })),
      });
    }
    if (splitType === 'percentage') {
      return calculateSplit({
        type: 'percentage',
        ...base,
        assignments: participants.map((p) => ({ userId: p.id, user: p, percentage: parseAmount(percent[p.id] ?? '') })),
      });
    }
    return calculateSplit({ type: 'equal', ...base, participants: participants.map((p) => ({ userId: p.id, user: p })) });
  }, [total, participants, paidBy, splitType, custom, percent, decimals]);

  const toggle = (id: string) =>
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSave = title.trim().length >= 2 && total > 0 && !!split?.isValid;

  const save = () => {
    if (!canSave || !split) return;
    create.mutate(
      {
        title: title.trim(),
        description: notes.trim() || undefined,
        amount: total,
        currency,
        category,
        paidBy,
        splitType,
        splits: split.splits.map((s) => ({ userId: s.userId, amount: s.amount, percentage: s.percentage })),
        groupId,
        date: daysAgoISO(dayOffset),
      },
      { onSuccess: () => navigation.goBack() },
    );
  };

  const remaining =
    splitType === 'custom'
      ? total - participants.reduce((s, p) => s + parseAmount(custom[p.id] ?? ''), 0)
      : splitType === 'percentage'
        ? 100 - participants.reduce((s, p) => s + parseAmount(percent[p.id] ?? ''), 0)
        : 0;

  const youOr = (p: User) => (p.id === me.id ? tr('common.you') : p.name);
  const WHEN = [tr('date.today'), tr('date.yesterday'), tr('date.twoDaysAgo')];

  return (
    <Screen footer={<Button title={tr('expense.save')} size="lg" fullWidth disabled={!canSave} loading={create.isPending} onPress={save} />}>
      {draft?.note ? (
        <Card variant="alt" padding={12} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="auto-awesome" size={18} color={t.colors.primary} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {draft.note}
          </Text>
        </Card>
      ) : null}

      <AmountInput
        value={amount}
        onChangeText={setAmount}
        currency={currency}
        onCurrencyPress={() => setCurrencyOpen(true)}
        autoFocus={!draft}
      />
      <Input value={title} onChangeText={setTitle} placeholder={tr('expense.whatFor')} icon="edit" maxLength={100} />

      {/* Category */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16, paddingLeft: 16, flexGrow: 0 }}>
        {EXPENSE_CATEGORIES.map((c) => {
          const active = c.id === category;
          const col = categoryColor(c.id, t.isDark);
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tr(c.labelKey)}
              onPress={() => setCategory(c.id)}
              style={{
                width: 76,
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: t.radius.md,
                borderWidth: 1.5,
                borderColor: active ? col : t.colors.border,
                backgroundColor: active ? col + (t.isDark ? '26' : '14') : t.colors.surface,
              }}
            >
              <Text style={{ fontSize: 22, lineHeight: 28 }}>{c.emoji}</Text>
              <Text variant="caption" numberOfLines={1} color={active ? col : t.colors.textSecondary} style={{ marginTop: 2, fontSize: 11 }}>
                {tr(c.shortKey)}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ width: 16 }} />
      </ScrollView>

      {/* Context rows */}
      <Card padding={4} style={{ paddingHorizontal: 12, marginTop: t.spacing.base }}>
        <ListRow
          leading={group ? <GroupTile name={group.name} size={32} /> : <Icon name="workspaces-outline" color={t.colors.textSecondary} />}
          title={group ? group.name : tr('expense.noGroup')}
          subtitle={tr('expense.group')}
          chevron
          divider
          onPress={() => setSheet('group')}
        />
        <ListRow
          leading={<Avatar name={payer.name} size="sm" />}
          title={payer.id === me.id ? tr('expense.youPaid') : tr('expense.theyPaid', { name: firstName(payer.name) })}
          subtitle={tr('expense.paidBy')}
          chevron
          divider
          onPress={() => setSheet('payer')}
        />
        <View style={{ paddingVertical: 12 }}>
          <Text variant="caption" tone="tertiary" style={{ marginBottom: 8 }}>
            {tr('expense.when')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WHEN.map((label, i) => (
              <Chip key={label} label={label} selected={dayOffset === i} onPress={() => setDayOffset(i)} />
            ))}
          </View>
        </View>
      </Card>

      {/* Participants */}
      <Text variant="h3" style={{ marginTop: t.spacing.lg, marginBottom: 10 }}>
        {tr('expense.splitBetween')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {people.map((p) => (
          <Chip
            key={p.id}
            label={p.id === me.id ? tr('common.you') : firstName(p.name)}
            selected={participantIds.has(p.id)}
            onPress={() => toggle(p.id)}
            leading={<Avatar name={p.name} size="xs" />}
          />
        ))}
      </View>

      <SegmentedControl
        style={{ marginTop: t.spacing.base }}
        value={splitType}
        onChange={(v) => setSplitType(v)}
        options={SPLIT_TYPES.map((s) => ({ value: s.id as SplitType, label: tr(s.labelKey) }))}
      />

      {/* Per-person breakdown */}
      <Card style={{ marginTop: 12 }} padding={4}>
        {participants.length === 0 ? (
          <Text tone="tertiary" style={{ padding: 12 }}>
            {tr('expense.pickOne')}
          </Text>
        ) : (
          participants.map((p, i) => {
            const share = split?.isValid ? split.splits.find((s) => s.userId === p.id)?.amount : undefined;
            return (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderBottomWidth: i < participants.length - 1 ? 1 : 0,
                  borderBottomColor: t.colors.border,
                }}
              >
                <Avatar name={p.name} size="sm" />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {youOr(p)}
                </Text>
                {splitType === 'equal' ? (
                  <Text variant="bodyStrong" tabular tone="secondary">
                    {share !== undefined ? formatCurrency(share, currency) : '—'}
                  </Text>
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: t.colors.border,
                      borderRadius: t.radius.sm,
                      paddingHorizontal: 10,
                      minWidth: 96,
                      height: 40,
                    }}
                  >
                    {splitType === 'custom' ? <Text tone="tertiary">{getCurrencySymbol(currency)}</Text> : null}
                    <TextInput
                      value={(splitType === 'custom' ? custom : percent)[p.id] ?? ''}
                      onChangeText={(v) =>
                        splitType === 'custom'
                          ? setCustom((prev) => ({ ...prev, [p.id]: cleanAmountInput(v, currency) }))
                          : setPercent((prev) => ({ ...prev, [p.id]: v.replace(',', '.').replace(/[^0-9.]/g, '') }))
                      }
                      keyboardType={splitType === 'custom' && decimals === 0 ? 'number-pad' : 'decimal-pad'}
                      placeholder="0"
                      placeholderTextColor={t.colors.textTertiary}
                      style={{ flex: 1, textAlign: 'right', fontFamily: t.fonts.semibold, fontSize: 15, color: t.colors.text }}
                      accessibilityLabel={tr(splitType === 'custom' ? 'expense.amountFor' : 'expense.percentFor', { name: p.name })}
                    />
                    {splitType === 'percentage' ? <Text tone="tertiary">%</Text> : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </Card>
      {splitType !== 'equal' && total > 0 ? (
        <Text variant="caption" tone={Math.abs(remaining) < 0.01 ? 'positive' : 'warning'} style={{ marginTop: 8 }}>
          {Math.abs(remaining) < 0.01
            ? `✓ ${tr('expense.addsUp')}`
            : splitType === 'custom'
              ? tr(remaining > 0 ? 'expense.leftToAssign' : 'expense.overTotal', { amount: formatCurrency(Math.abs(remaining), currency) })
              : tr(remaining > 0 ? 'expense.leftToAssign' : 'expense.over100', { amount: `${Math.abs(remaining).toFixed(1)}%` })}
        </Text>
      ) : null}

      <Input label={tr('expense.notes')} value={notes} onChangeText={setNotes} placeholder={tr('expense.notesPlaceholder')} containerStyle={{ marginTop: t.spacing.lg }} />

      <BottomSheet visible={sheet === 'group'} onClose={() => setSheet(null)} title={tr('expense.chooseGroup')}>
        <ListRow
          leading={<Icon name="person-outline" color={t.colors.textSecondary} />}
          title={tr('expense.noGroup')}
          subtitle={tr('expense.justFriends')}
          onPress={() => {
            setGroupId(undefined);
            setSheet(null);
          }}
          trailing={!groupId ? <Icon name="check" color={t.colors.primary} /> : null}
        />
        {groups.map((g) => (
          <ListRow
            key={g.id}
            leading={<GroupTile name={g.name} size={36} />}
            title={g.name}
            subtitle={tr('common.people', { count: g.members.length })}
            onPress={() => {
              setGroupId(g.id);
              setSheet(null);
            }}
            trailing={g.id === groupId ? <Icon name="check" color={t.colors.primary} /> : null}
          />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'payer'} onClose={() => setSheet(null)} title={tr('expense.whoPaid')}>
        <ScrollView style={{ maxHeight: 420 }}>
          {people.map((p) => (
            <ListRow
              key={p.id}
              leading={<Avatar name={p.name} size="sm" />}
              title={youOr(p)}
              onPress={() => {
                setPaidBy(p.id);
                setParticipantIds((prev) => new Set(prev).add(p.id));
                setSheet(null);
              }}
              trailing={p.id === paidBy ? <Icon name="check" color={t.colors.primary} /> : null}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      <CurrencyPicker
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        value={currency}
        suggested={[group?.currency, myCurrency]}
        onSelect={(c) => {
          setCurrency(c);
          setCurrencyTouched(true);
          setAmount((a) => cleanAmountInput(a, c));
        }}
      />
    </Screen>
  );
};

export default ManualExpenseScreen;
