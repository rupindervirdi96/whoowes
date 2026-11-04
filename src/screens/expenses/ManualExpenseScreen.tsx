import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { Expense, ExpenseCategory, SplitType, User } from '../../types';
import { useCurrentUser } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { useGroups } from '../../hooks/useGroups';
import { useCreateExpense, useExpense, useExpenses, useUpdateExpense } from '../../hooks/useExpenses';
import { useShowModal } from '../../store/uiStore';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useT, type TKey } from '../../i18n';
import { calculateSplit, splitByShares } from '../../utils/splitEngine';
import { cleanAmountInput, currencyDecimals, formatCurrency, getCurrencySymbol, isKnownCurrency, parseAmount, amountToInput } from '../../utils/currency';
import { formatSmartDate } from '../../utils/date';
import { firstName } from '../../utils/money';
import { CATEGORY_BY_ID, EXPENSE_CATEGORIES } from '../../constants';
import Screen from '../../components/ui/Screen';
import AmountInput from '../../components/ui/AmountInput';
import Input from '../../components/ui/Input';
import Text from '../../components/ui/Text';
import Chip, { SegmentedControl } from '../../components/ui/Chip';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import IconButton from '../../components/ui/IconButton';
import BottomSheet from '../../components/ui/BottomSheet';
import ListRow from '../../components/ui/ListRow';
import { categoryColor } from '../../components/ui/CategoryIcon';
import GroupTile from '../../components/GroupTile';
import CurrencyPicker from '../../components/CurrencyPicker';
import DatePickerSheet from '../../components/DatePickerSheet';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

/** "shares" is worked out here and saved as exact amounts. */
type SplitMode = Exclude<SplitType, 'item_based'> | 'shares';

const SPLIT_MODES: Array<{ value: SplitMode; labelKey: TKey }> = [
  { value: 'equal', labelKey: 'split.short.equal' },
  { value: 'custom', labelKey: 'split.short.custom' },
  { value: 'percentage', labelKey: 'split.short.percentage' },
  { value: 'shares', labelKey: 'split.short.shares' },
];

/** Words in a title that point to a category, so it can be picked for you. */
const CATEGORY_HINTS: Array<[ExpenseCategory, RegExp]> = [
  ['transport', /\b(uber|lyft|taxi|cab|gas|fuel|petrol|parking|train|bus|metro|subway|flight|airfare|toll|car rental|ferry)\b/i],
  ['accommodation', /\b(hotel|airbnb|hostel|motel|rent|lodging|cabin|resort)\b/i],
  ['utilities', /\b(electric(ity)?|water bill|internet|wi-?fi|phone bill|utilit(y|ies)|power bill|heating)\b/i],
  ['entertainment', /\b(movie|cinema|concert|tickets?|netflix|spotify|show|museum|bowling|game|festival|karaoke)\b/i],
  ['health', /\b(pharmacy|doctor|medicine|meds|gym|dentist|clinic|hospital)\b/i],
  ['shopping', /\b(amazon|clothes|shopping|gift|ikea|store|mall|shoes)\b/i],
  ['food', /\b(dinner|lunch|breakfast|brunch|pizza|coffee|cafe|restaurant|groceries|grocery|food|drinks|beers?|bar|sushi|burgers?|takeout|snacks|tacos)\b/i],
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Saved time for a day: now if it's today, else midday so time zones can't move it to another day. */
function dateToISO(day: Date) {
  if (sameDay(day, new Date())) return new Date().toISOString();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString();
}

/** Reads a draft date ("2026-10-30" or a full timestamp) as a local day, never in the future. */
function draftDay(value?: string): Date {
  const today = startOfDay(new Date());
  if (!value) return today;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return isNaN(d.getTime()) || d > today ? today : startOfDay(d);
}

/** The form's starting values for an expense being edited. */
function seedFrom(e: Expense) {
  const mode: SplitMode = e.splitType === 'equal' ? 'equal' : e.splitType === 'percentage' ? 'percentage' : 'custom';
  return {
    currency: e.currency,
    amount: amountToInput(e.amount, e.currency),
    title: e.title,
    category: e.category,
    groupId: e.groupId ?? undefined,
    paidBy: e.paidBy,
    participantIds: e.splits.map((s) => s.userId),
    splitMode: mode,
    custom: mode === 'custom' ? Object.fromEntries(e.splits.map((s) => [s.userId, amountToInput(s.amount, e.currency)])) : {},
    percent: mode === 'percentage' ? Object.fromEntries(e.splits.map((s) => [s.userId, String(s.percentage ?? '')])) : {},
    day: draftDay(e.date),
    notes: e.description ?? '',
  };
}

/** Add an expense, or (with editId) change one: the same form, filled in. */
const ManualExpenseScreen: React.FC<RootScreenProps<'ManualExpense'>> = (props) => {
  const editId = props.route.params?.editId;
  const { data: editing, isLoading } = useExpense(editId ?? '');
  const { t: tr } = useT();
  if (editId && !editing) {
    return (
      <Screen>
        {isLoading ? (
          <SkeletonList rows={4} />
        ) : (
          <EmptyState emoji="🫥" title={tr('expenseDetail.notFound')} body={tr('expenseDetail.maybeDeleted')} actionLabel={tr('common.goBack')} onAction={() => props.navigation.goBack()} />
        )}
      </Screen>
    );
  }
  return <ExpenseForm {...props} editing={editing} />;
};

const ExpenseForm: React.FC<RootScreenProps<'ManualExpense'> & { editing?: Expense }> = ({ route, navigation, editing }) => {
  const params = route.params ?? {};
  const draft = params.draft;
  const seed = useMemo(() => (editing ? seedFrom(editing) : null), [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const { data: friends = [] } = useFriends();
  const { data: groups = [] } = useGroups();
  const { data: pastExpenses = [] } = useExpenses();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const showModal = useShowModal();

  useLayoutEffect(() => {
    if (editing) navigation.setOptions({ title: tr('expense.editTitle') });
  }, [editing, navigation, tr]);

  const initialGroup = groups.find((g) => g.id === (draft?.groupId ?? params.groupId));
  const [currency, setCurrency] = useState<string>(
    seed?.currency ?? (isKnownCurrency(draft?.currency) ? draft!.currency : (initialGroup?.currency ?? myCurrency)),
  );
  // Once the user picks a currency themselves, choosing a group no longer changes it.
  const [currencyTouched, setCurrencyTouched] = useState(!!draft?.currency || !!seed);
  const [amount, setAmount] = useState(seed?.amount ?? (draft?.amount ? String(draft.amount) : ''));
  const [title, setTitle] = useState(seed?.title ?? draft?.title ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(seed?.category ?? draft?.category ?? 'food');
  // Picking a category by hand stops the title from changing it.
  const [categoryTouched, setCategoryTouched] = useState(!!draft?.category || !!seed);
  const [titleFocused, setTitleFocused] = useState(false);
  const [groupId, setGroupId] = useState<string | undefined>(seed ? seed.groupId : (draft?.groupId ?? params.groupId));
  const [paidBy, setPaidBy] = useState(seed?.paidBy ?? draft?.paidBy ?? me.id);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(seed?.participantIds ?? draft?.participantIds ?? [me.id, ...(params.friendId ? [params.friendId] : [])]),
  );
  const [splitMode, setSplitMode] = useState<SplitMode>(seed?.splitMode ?? draft?.splitType ?? 'equal');
  const [custom, setCustom] = useState<Record<string, string>>(
    seed?.custom ?? Object.fromEntries(Object.entries(draft?.customAmounts ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [percent, setPercent] = useState<Record<string, string>>(seed?.percent ?? {});
  const [shares, setShares] = useState<Record<string, number>>({});
  const [day, setDay] = useState<Date>(() => seed?.day ?? draftDay(draft?.date));
  const [notes, setNotes] = useState(seed?.notes ?? '');
  const [sheet, setSheet] = useState<'group' | 'payer' | 'date' | 'currency' | 'split' | 'category' | 'notes' | null>(null);

  const openCurrency = useCallback(() => setSheet('currency'), []);
  const group = groups.find((g) => g.id === groupId);
  const decimals = currencyDecimals(currency);

  // People who can take part: the group's members, or me + my friends.
  // When editing, everyone already on it stays listed, even if they've left the group since.
  const people: User[] = useMemo(() => {
    const list = group ? group.members.map((m) => m.user) : [me, ...friends.map((f) => f.friendUser)];
    if (!editing) return list;
    const extra = [editing.paidByUser, ...editing.splits.map((s) => s.user)].filter((u) => !list.some((p) => p.id === u.id));
    return [...list, ...extra.filter((u, i, a) => a.findIndex((x) => x.id === u.id) === i)];
  }, [group, me, friends, editing]);

  // Picking a group puts the whole group on the bill, in the group's currency.
  const keepPeople = useRef(!!editing);
  useEffect(() => {
    if (keepPeople.current) {
      if (groupId === (editing?.groupId ?? undefined)) return;
      keepPeople.current = false;
    }
    if (group && !draft) setParticipantIds(new Set(group.members.map((m) => m.userId)));
    if (!currencyTouched) setCurrency(group?.currency ?? myCurrency);
  }, [group, groupId, editing, draft, currencyTouched, myCurrency]);

  // Guess the category from the title ("Uber to airport" → Transport) until the user picks one.
  useEffect(() => {
    if (categoryTouched) return;
    const hit = CATEGORY_HINTS.find(([, re]) => re.test(title));
    if (hit) setCategory(hit[0]);
  }, [title, categoryTouched]);

  // Earlier expenses whose title matches what's being typed, newest first, one per title.
  const suggestions = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const out: Array<{ title: string; category: ExpenseCategory }> = [];
    for (const e of pastExpenses) {
      const key = e.title.trim().toLowerCase();
      if (key === q || seen.has(key) || !key.includes(q)) continue;
      seen.add(key);
      out.push({ title: e.title.trim(), category: e.category });
      if (out.length === 3) break;
    }
    return out;
  }, [title, pastExpenses]);

  const participants = people.filter((p) => participantIds.has(p.id));
  const total = parseAmount(amount);
  const payer = people.find((p) => p.id === paidBy) ?? me;
  const sharesOf = (id: string) => shares[id] ?? 1;

  const split = useMemo(() => {
    if (total <= 0 || participants.length === 0) return null;
    const base = { total, paidBy, decimals };
    if (splitMode === 'custom') {
      return calculateSplit({
        type: 'custom',
        ...base,
        assignments: participants.map((p) => ({ userId: p.id, user: p, amount: parseAmount(custom[p.id] ?? '') })),
      });
    }
    if (splitMode === 'percentage') {
      return calculateSplit({
        type: 'percentage',
        ...base,
        assignments: participants.map((p) => ({ userId: p.id, user: p, percentage: parseAmount(percent[p.id] ?? '') })),
      });
    }
    if (splitMode === 'shares') {
      const amounts = splitByShares(total, Object.fromEntries(participants.map((p) => [p.id, shares[p.id] ?? 1])), decimals);
      return calculateSplit({
        type: 'custom',
        ...base,
        // People on 0 shares owe nothing.
        assignments: participants.map((p) => ({ userId: p.id, user: p, amount: amounts[p.id] ?? 0 })),
      });
    }
    return calculateSplit({ type: 'equal', ...base, participants: participants.map((p) => ({ userId: p.id, user: p })) });
  }, [total, participants, paidBy, splitMode, custom, percent, shares, decimals]);

  const toggle = (id: string) =>
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = people.length > 0 && people.every((p) => participantIds.has(p.id));

  // The server only accepts expenses I'm part of, as payer or in the split.
  const includesMe = paidBy === me.id || participantIds.has(me.id);
  const sharesOk = splitMode !== 'shares' || participants.some((p) => sharesOf(p.id) > 0);
  const canSave = title.trim().length >= 2 && total > 0 && !!split?.isValid && includesMe && sharesOk;

  const save = () => {
    if (!canSave || !split) return;
    const splits = split.splits.map((s) => ({ userId: s.userId, amount: s.amount, percentage: s.percentage }));
    const payload = {
      title: title.trim(),
      description: notes.trim() || undefined,
      amount: total,
      currency,
      category,
      paidBy,
      splitType: (splitMode === 'shares' ? 'custom' : splitMode) as SplitType,
      splits,
      groupId,
      date: dateToISO(day),
    };
    if (!editing) {
      create.mutate(payload, { onSuccess: () => navigation.goBack() });
      return;
    }

    // Same day as before: keep the original time, so the date doesn't count as changed.
    if (sameDay(day, draftDay(editing.date))) payload.date = editing.date;
    // A receipt split stays a receipt split while nobody's share changed.
    const shareOf = (list: Array<{ userId: string; amount: number }>, id: string) => list.find((x) => x.userId === id)?.amount;
    if (editing.splitType === 'item_based' && editing.splits.length === splits.length && editing.splits.every((x) => shareOf(splits, x.userId) === x.amount)) {
      payload.splitType = 'item_based';
    }

    const run = () => update.mutate({ expenseId: editing.id, payload }, { onSuccess: () => navigation.goBack() });
    // Someone already paid their share back: changing it opens it again, so check first.
    const reopened = editing.splits.filter(
      (x) => x.paid && x.userId !== editing.paidBy && (paidBy !== editing.paidBy || shareOf(splits, x.userId) !== x.amount),
    );
    if (reopened.length === 0) return run();
    showModal({
      title: tr('expense.edit.paidTitle'),
      body: tr('expense.edit.paidBody', { names: reopened.map((x) => (x.userId === me.id ? tr('common.you') : firstName(x.user.name))).join(', ') }),
      confirmLabel: tr('expense.saveChanges'),
      onConfirm: run,
    });
  };

  const remaining =
    splitMode === 'custom'
      ? total - participants.reduce((s, p) => s + parseAmount(custom[p.id] ?? ''), 0)
      : splitMode === 'percentage'
        ? 100 - participants.reduce((s, p) => s + parseAmount(percent[p.id] ?? ''), 0)
        : 0;

  // Shares out what's left among the people who have nothing yet (or everyone, if all have something).
  const splitRest = () => {
    if (remaining <= 0) return;
    const values = splitMode === 'custom' ? custom : percent;
    const blank = participants.filter((p) => !parseAmount(values[p.id] ?? ''));
    const who = blank.length ? blank : participants;
    if (splitMode === 'custom') {
      const parts = splitByShares(remaining, Object.fromEntries(who.map((p) => [p.id, 1])), decimals);
      setCustom((prev) => {
        const next = { ...prev };
        for (const p of who) next[p.id] = amountToInput(parseAmount(prev[p.id] ?? '') + (parts[p.id] ?? 0), currency);
        return next;
      });
    } else {
      // Percent to one decimal; the last person takes the rounding.
      const each = Math.floor((remaining / who.length) * 10) / 10;
      setPercent((prev) => {
        const next = { ...prev };
        who.forEach((p, i) => {
          const add = i === who.length - 1 ? remaining - each * (who.length - 1) : each;
          next[p.id] = String(Math.round((parseAmount(prev[p.id] ?? '') + add) * 10) / 10);
        });
        return next;
      });
    }
  };

  const youOr = (p: User) => (p.id === me.id ? tr('common.you') : p.name);

  // One-line outcome shown above the save button.
  const myShare = split?.isValid ? (split.splits.find((s) => s.userId === me.id)?.amount ?? 0) : 0;
  const outcome = !split?.isValid
    ? null
    : paidBy === me.id
      ? total - myShare > 0
        ? { tone: 'positive' as const, text: tr('expense.youGetBack', { amount: formatCurrency(total - myShare, currency) }) }
        : { tone: 'tertiary' as const, text: tr('expense.onlyYou') }
      : myShare > 0
        ? { tone: 'negative' as const, text: tr('expense.youOweName', { name: firstName(payer.name), amount: formatCurrency(myShare, currency) }) }
        : null;

  const equalEach = splitMode === 'equal' && split?.isValid && participants.length > 1 ? split.splits[0]?.amount : undefined;
  const catColor = categoryColor(category, t.isDark);

  // One line under the people: how it's split, and whether it adds up.
  const addsUp = Math.abs(remaining) < 0.01;
  const splitSummary: { text: string; tone: 'secondary' | 'warning' | 'positive' } =
    participants.length === 0
      ? { text: tr('expense.pickOne'), tone: 'warning' }
      : splitMode === 'equal'
        ? { text: equalEach !== undefined ? `${tr('split.equal')} · ${tr('expense.each', { amount: formatCurrency(equalEach, currency) })}` : tr('split.equal'), tone: 'secondary' }
        : splitMode === 'shares'
          ? { text: `${tr('split.shares')} · ${participants.map((p) => `${p.id === me.id ? tr('common.you') : firstName(p.name)} ${sharesOf(p.id)}`).join(', ')}`, tone: 'secondary' }
          : total <= 0
            ? { text: tr(splitMode === 'custom' ? 'split.custom' : 'split.percentage'), tone: 'secondary' }
            : addsUp
              ? { text: `${tr(splitMode === 'custom' ? 'split.custom' : 'split.percentage')} · ✓ ${tr('expense.addsUp')}`, tone: 'positive' }
              : {
                  text:
                    splitMode === 'custom'
                      ? tr(remaining > 0 ? 'expense.leftToAssign' : 'expense.overTotal', { amount: formatCurrency(Math.abs(remaining), currency) })
                      : tr(remaining > 0 ? 'expense.leftToAssign' : 'expense.over100', { amount: `${Math.abs(remaining).toFixed(1)}%` }),
                  tone: 'warning',
                };

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          {!includesMe && participants.length > 0 ? (
            <Text variant="caption" tone="warning" align="center">
              {tr('expense.includeYou')}
            </Text>
          ) : outcome ? (
            <Text variant="label" tone={outcome.tone} align="center">
              {outcome.text}
            </Text>
          ) : null}
          <Button
            title={editing ? tr('expense.saveChanges') : tr('expense.save')}
            size="lg"
            fullWidth
            disabled={!canSave}
            loading={create.isPending || update.isPending}
            onPress={save}
          />
        </View>
      }
    >
      {draft?.note ? (
        <Card variant="alt" padding={12} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="auto-awesome" size={18} color={t.colors.primary} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {draft.note}
          </Text>
        </Card>
      ) : null}

      <AmountInput value={amount} onChangeText={setAmount} currency={currency} onCurrencyPress={openCurrency} autoFocus={!draft && !editing} />

      {/* What it was for, with its category on the left (guessed from the title until picked). */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('expense.changeCategory', { name: tr(CATEGORY_BY_ID[category].labelKey) })}
          onPress={() => setSheet('category')}
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: t.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: catColor,
            backgroundColor: catColor + (t.isDark ? '26' : '14'),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 22, lineHeight: 28 }}>{CATEGORY_BY_ID[category].emoji}</Text>
        </Pressable>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={tr('expense.whatFor')}
          maxLength={100}
          returnKeyType="done"
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          containerStyle={{ flex: 1, marginBottom: 0 }}
        />
      </View>
      {suggestions.length && titleFocused ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Text variant="caption" tone="tertiary">
            {tr('expense.recent')}
          </Text>
          {suggestions.map((sg) => (
            <Chip
              key={sg.title}
              label={sg.title}
              leading={<Text style={{ fontSize: 15, marginLeft: 8 }}>{CATEGORY_BY_ID[sg.category].emoji}</Text>}
              onPress={() => {
                setTitle(sg.title);
                setCategory(sg.category);
                setCategoryTouched(true);
              }}
            />
          ))}
        </View>
      ) : null}

      {/* Details: one tap each, all on one line where they fit. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: t.spacing.md }}>
        <DetailPill
          leading={group ? <GroupTile name={group.name} size={22} /> : <Icon name="workspaces-outline" size={16} color={t.colors.textSecondary} />}
          label={group ? group.name : tr('expense.noGroup')}
          accessibilityLabel={`${tr('expense.group')}: ${group ? group.name : tr('expense.noGroup')}`}
          onPress={() => setSheet('group')}
        />
        <DetailPill
          leading={<Avatar name={payer.name} uri={payer.avatarUrl} size="xs" />}
          label={payer.id === me.id ? tr('expense.youPaid') : tr('expense.theyPaid', { name: firstName(payer.name) })}
          accessibilityLabel={`${tr('expense.paidBy')}: ${youOr(payer)}`}
          onPress={() => setSheet('payer')}
        />
        <DetailPill
          leading={<Icon name="event" size={16} color={t.colors.textSecondary} />}
          label={formatSmartDate(day)}
          accessibilityLabel={`${tr('expense.when')}: ${formatSmartDate(day)}`}
          onPress={() => setSheet('date')}
        />
        <DetailPill
          leading={<Icon name="notes" size={16} color={notes ? t.colors.primary : t.colors.textSecondary} />}
          label={notes ? notes.split('\n')[0] : tr('expense.note')}
          accessibilityLabel={notes ? `${tr('expense.notes')}: ${notes}` : tr('expense.addNote')}
          onPress={() => setSheet('notes')}
        />
      </View>

      {/* Who's in: tap a face to add or drop them. Amounts, percent and shares live under Adjust. */}
      <Card padding={14} style={{ marginTop: t.spacing.base }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="label" tone="secondary">
            {tr('expense.splitBetween')}
          </Text>
          {people.length > 2 ? (
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              onPress={() => setParticipantIds(allSelected ? new Set([me.id]) : new Set(people.map((p) => p.id)))}
            >
              <Text variant="label" tone="primary">
                {allSelected ? tr('expense.justMe') : tr('expense.selectAll')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, marginTop: 10, marginHorizontal: -14 }}
          contentContainerStyle={{ gap: 4, paddingHorizontal: 10 }}
        >
          {people.map((p) => (
            <PersonToggle key={p.id} user={p} label={p.id === me.id ? tr('common.you') : firstName(p.name)} selected={participantIds.has(p.id)} onPress={() => toggle(p.id)} />
          ))}
        </ScrollView>
        <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text variant="label" tone={splitSummary.tone} numberOfLines={2} style={{ flex: 1 }}>
            {splitSummary.text}
          </Text>
          <Button title={tr('expense.adjust')} icon="tune" size="sm" variant="secondary" onPress={() => setSheet('split')} disabled={participants.length === 0} />
        </View>
      </Card>

      {/* ── Sheets ── */}
      <BottomSheet visible={sheet === 'split'} onClose={() => setSheet(null)} title={tr('expense.howToSplit')}>
        <SegmentedControl value={splitMode} onChange={setSplitMode} options={SPLIT_MODES.map((m) => ({ value: m.value, label: tr(m.labelKey) }))} />
        {splitMode === 'shares' ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>
            {tr('expense.sharesHint')}
          </Text>
        ) : null}
        <ScrollView style={{ maxHeight: 320, marginTop: 12 }} keyboardShouldPersistTaps="handled">
          {participants.map((p, i) => {
            const share = split?.isValid ? split.splits.find((x) => x.userId === p.id)?.amount : undefined;
            const name = youOr(p);
            return (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  borderBottomWidth: i < participants.length - 1 ? 1 : 0,
                  borderBottomColor: t.colors.border,
                }}
              >
                <Avatar name={p.name} uri={p.avatarUrl} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {name}
                  </Text>
                  {(splitMode === 'percentage' || splitMode === 'shares') && share !== undefined ? (
                    <Text variant="caption" tone="tertiary" tabular>
                      {formatCurrency(share, currency)}
                    </Text>
                  ) : null}
                </View>
                {splitMode === 'equal' ? (
                  share !== undefined ? (
                    <Text variant="bodyStrong" tabular tone="secondary">
                      {formatCurrency(share, currency)}
                    </Text>
                  ) : null
                ) : splitMode === 'shares' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel={tr('expense.sharesFor', { name })}>
                    <IconButton
                      icon="remove"
                      variant="surface"
                      size={34}
                      accessibilityLabel={tr('expense.removeShare', { name })}
                      onPress={() => setShares((v) => ({ ...v, [p.id]: Math.max(0, sharesOf(p.id) - 1) }))}
                    />
                    <Text variant="bodyStrong" tabular align="center" style={{ minWidth: 28 }}>
                      {sharesOf(p.id)}
                    </Text>
                    <IconButton
                      icon="add"
                      variant="soft"
                      size={34}
                      accessibilityLabel={tr('expense.addShare', { name })}
                      onPress={() => setShares((v) => ({ ...v, [p.id]: Math.min(99, sharesOf(p.id) + 1) }))}
                    />
                  </View>
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
                    {splitMode === 'custom' ? <Text tone="tertiary">{getCurrencySymbol(currency)}</Text> : null}
                    <TextInput
                      value={(splitMode === 'custom' ? custom : percent)[p.id] ?? ''}
                      onChangeText={(v) =>
                        splitMode === 'custom'
                          ? setCustom((prev) => ({ ...prev, [p.id]: cleanAmountInput(v, currency) }))
                          : setPercent((prev) => ({ ...prev, [p.id]: v.replace(',', '.').replace(/[^0-9.]/g, '') }))
                      }
                      keyboardType={splitMode === 'custom' && decimals === 0 ? 'number-pad' : 'decimal-pad'}
                      placeholder="0"
                      placeholderTextColor={t.colors.textTertiary}
                      selectionColor={t.colors.primary}
                      style={{ flex: 1, textAlign: 'right', fontFamily: t.fonts.semibold, fontSize: 15, color: t.colors.text }}
                      accessibilityLabel={tr(splitMode === 'custom' ? 'expense.amountFor' : 'expense.percentFor', { name: p.name })}
                    />
                    {splitMode === 'percentage' ? <Text tone="tertiary">%</Text> : null}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
        {(splitMode === 'custom' || splitMode === 'percentage') && total > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
            <Text variant="caption" tone={addsUp ? 'positive' : 'warning'} style={{ flexShrink: 1 }}>
              {addsUp ? `✓ ${tr('expense.addsUp')}` : splitSummary.text}
            </Text>
            {remaining > 0.009 && participants.length > 0 ? (
              <Pressable onPress={splitRest} hitSlop={8} accessibilityRole="button">
                <Text variant="label" tone="primary">
                  {tr('expense.splitRest')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <Button title={tr('common.done')} fullWidth style={{ marginTop: t.spacing.base }} onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'category'} onClose={() => setSheet(null)} title={tr('expense.category')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {EXPENSE_CATEGORIES.map((c) => {
            const active = c.id === category;
            const col = categoryColor(c.id, t.isDark);
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tr(c.labelKey)}
                onPress={() => {
                  setCategory(c.id);
                  setCategoryTouched(true);
                  setSheet(null);
                }}
                style={{
                  width: '23%',
                  flexGrow: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: t.radius.md,
                  borderWidth: 1.5,
                  borderColor: active ? col : t.colors.border,
                  backgroundColor: active ? col + (t.isDark ? '26' : '14') : t.colors.surface,
                }}
              >
                <Text style={{ fontSize: 24, lineHeight: 30 }}>{c.emoji}</Text>
                <Text variant="caption" numberOfLines={1} color={active ? col : t.colors.textSecondary} style={{ marginTop: 2, fontSize: 11 }}>
                  {tr(c.shortKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'notes'} onClose={() => setSheet(null)} title={tr('expense.notes')}>
        <Input value={notes} onChangeText={setNotes} placeholder={tr('expense.notesPlaceholder')} multiline maxLength={1000} />
        <Button title={tr('common.done')} fullWidth onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'group'} onClose={() => setSheet(null)} title={tr('expense.chooseGroup')}>
        <ScrollView style={{ maxHeight: 420 }}>
          <ListRow
            leading={
              <Leading>
                <SoftIcon name="person-outline" />
              </Leading>
            }
            title={tr('expense.noGroup')}
            subtitle={tr('expense.justFriends')}
            divider={groups.length > 0}
            onPress={() => {
              setGroupId(undefined);
              setSheet(null);
            }}
            trailing={!groupId ? <Icon name="check" color={t.colors.primary} /> : null}
          />
          {groups.map((g, i) => (
            <ListRow
              key={g.id}
              leading={
                <Leading>
                  <GroupTile name={g.name} size={40} />
                </Leading>
              }
              title={g.name}
              subtitle={tr('common.people', { count: g.members.length })}
              divider={i < groups.length - 1}
              onPress={() => {
                setGroupId(g.id);
                setSheet(null);
              }}
              trailing={g.id === groupId ? <Icon name="check" color={t.colors.primary} /> : null}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={sheet === 'payer'} onClose={() => setSheet(null)} title={tr('expense.whoPaid')}>
        <ScrollView style={{ maxHeight: 420 }}>
          {people.map((p, i) => (
            <ListRow
              key={p.id}
              leading={
                <Leading>
                  <Avatar name={p.name} uri={p.avatarUrl} size="md" />
                </Leading>
              }
              title={youOr(p)}
              divider={i < people.length - 1}
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

      <DatePickerSheet visible={sheet === 'date'} onClose={() => setSheet(null)} value={day} onSelect={setDay} />

      <CurrencyPicker
        visible={sheet === 'currency'}
        onClose={() => setSheet(null)}
        value={currency}
        suggested={[group?.currency, myCurrency]}
        onSelect={(c) => {
          setCurrency(c);
          setCurrencyTouched(true);
          setAmount((a) => cleanAmountInput(a, c));
          setCustom((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, cleanAmountInput(v, c)])));
        }}
      />
    </Screen>
  );
};

/** A compact tappable detail: "No group", "You paid", "Today", "Note". */
const DetailPill: React.FC<{ leading: React.ReactNode; label: string; accessibilityLabel: string; onPress: () => void }> = ({
  leading,
  label,
  accessibilityLabel,
  onPress,
}) => {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 36,
        maxWidth: '100%',
        paddingLeft: 8,
        paddingRight: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {leading}
      <Text variant="label" numberOfLines={1} style={{ flexShrink: 1, maxWidth: 140 }}>
        {label}
      </Text>
      <Icon name="expand-more" size={16} color={t.colors.textTertiary} />
    </Pressable>
  );
};

/** A face to tap in or out of the split. */
const PersonToggle: React.FC<{ user: User; label: string; selected: boolean; onPress: () => void }> = ({ user, label, selected, onPress }) => {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 60, alignItems: 'center' }}
    >
      <View style={{ padding: 2, borderRadius: 24, borderWidth: 2, borderColor: selected ? t.colors.primary : 'transparent', opacity: selected ? 1 : 0.45 }}>
        <Avatar name={user.name} uri={user.avatarUrl} size="md" />
      </View>
      {selected ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 8,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: t.colors.primary,
            borderWidth: 2,
            borderColor: t.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={10} color={t.colors.textOnPrimary} />
        </View>
      ) : null}
      <Text variant="caption" tone={selected ? 'default' : 'tertiary'} numberOfLines={1} style={{ marginTop: 4, maxWidth: 58 }}>
        {label}
      </Text>
    </Pressable>
  );
};

/** Same 40×40 slot for every row icon, so titles and dividers line up. */
const Leading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
);

/** Icon on a soft tile, the same size and shape as a group tile. */
const SoftIcon: React.FC<{ name: string }> = ({ name }) => {
  const t = useTheme();
  return (
    <View style={{ width: 40, height: 40, borderRadius: 40 * 0.32, backgroundColor: t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={20} color={t.colors.textSecondary} />
    </View>
  );
};

export default ManualExpenseScreen;
