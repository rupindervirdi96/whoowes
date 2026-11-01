import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { ExpenseCategory, SplitType, User } from '../../types';
import { useCurrentUser } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { useGroups } from '../../hooks/useGroups';
import { useCreateExpense, useExpenses } from '../../hooks/useExpenses';
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

const ManualExpenseScreen: React.FC<RootScreenProps<'ManualExpense'>> = ({ route, navigation }) => {
  const params = route.params ?? {};
  const draft = params.draft;
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const { data: friends = [] } = useFriends();
  const { data: groups = [] } = useGroups();
  const { data: pastExpenses = [] } = useExpenses();
  const create = useCreateExpense();

  const initialGroup = groups.find((g) => g.id === (draft?.groupId ?? params.groupId));
  const [currency, setCurrency] = useState<string>(
    isKnownCurrency(draft?.currency) ? draft!.currency : (initialGroup?.currency ?? myCurrency),
  );
  // Once the user picks a currency themselves, choosing a group no longer changes it.
  const [currencyTouched, setCurrencyTouched] = useState(!!draft?.currency);
  const [amount, setAmount] = useState(draft?.amount ? String(draft.amount) : '');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(draft?.category ?? 'food');
  // Picking a category by hand stops the title from changing it.
  const [categoryTouched, setCategoryTouched] = useState(!!draft?.category);
  const [titleFocused, setTitleFocused] = useState(false);
  const [groupId, setGroupId] = useState<string | undefined>(draft?.groupId ?? params.groupId);
  const [paidBy, setPaidBy] = useState(draft?.paidBy ?? me.id);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(draft?.participantIds ?? [me.id, ...(params.friendId ? [params.friendId] : [])]),
  );
  const [splitMode, setSplitMode] = useState<SplitMode>(draft?.splitType ?? 'equal');
  const [custom, setCustom] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(draft?.customAmounts ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [percent, setPercent] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, number>>({});
  const [day, setDay] = useState<Date>(() => draftDay(draft?.date));
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [sheet, setSheet] = useState<'group' | 'payer' | 'date' | 'currency' | null>(null);

  const openCurrency = useCallback(() => setSheet('currency'), []);
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
    create.mutate(
      {
        title: title.trim(),
        description: notes.trim() || undefined,
        amount: total,
        currency,
        category,
        paidBy,
        splitType: splitMode === 'shares' ? 'custom' : splitMode,
        splits: split.splits.map((s) => ({ userId: s.userId, amount: s.amount, percentage: s.percentage })),
        groupId,
        date: dateToISO(day),
      },
      { onSuccess: () => navigation.goBack() },
    );
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

  const today = startOfDay(new Date());
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const isCustomDay = !sameDay(day, today) && !sameDay(day, yesterday);
  const equalEach = splitMode === 'equal' && split?.isValid && participants.length > 1 ? split.splits[0]?.amount : undefined;

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
          <Button title={tr('expense.save')} size="lg" fullWidth disabled={!canSave} loading={create.isPending} onPress={save} />
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

      <AmountInput value={amount} onChangeText={setAmount} currency={currency} onCurrencyPress={openCurrency} autoFocus={!draft} />

      <Input
        value={title}
        onChangeText={setTitle}
        placeholder={tr('expense.whatFor')}
        icon="edit"
        maxLength={100}
        returnKeyType="done"
        onFocus={() => setTitleFocused(true)}
        onBlur={() => setTitleFocused(false)}
        containerStyle={suggestions.length && titleFocused ? { marginBottom: 8 } : undefined}
      />
      {suggestions.length && titleFocused ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: t.spacing.base }}>
          <Text variant="caption" tone="tertiary">
            {tr('expense.recent')}
          </Text>
          {suggestions.map((s) => (
            <Chip
              key={s.title}
              label={s.title}
              leading={<Text style={{ fontSize: 15, marginLeft: 8 }}>{CATEGORY_BY_ID[s.category].emoji}</Text>}
              onPress={() => {
                setTitle(s.title);
                setCategory(s.category);
                setCategoryTouched(true);
              }}
            />
          ))}
        </View>
      ) : null}

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
              onPress={() => {
                setCategory(c.id);
                setCategoryTouched(true);
              }}
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
          leading={
            <Leading>
              {group ? <GroupTile name={group.name} size={40} /> : <SoftIcon name="workspaces-outline" />}
            </Leading>
          }
          title={group ? group.name : tr('expense.noGroup')}
          subtitle={tr('expense.group')}
          chevron
          divider
          onPress={() => setSheet('group')}
        />
        <ListRow
          leading={
            <Leading>
              <Avatar name={payer.name} uri={payer.avatarUrl} size="md" />
            </Leading>
          }
          title={payer.id === me.id ? tr('expense.youPaid') : tr('expense.theyPaid', { name: firstName(payer.name) })}
          subtitle={tr('expense.paidBy')}
          chevron
          divider
          onPress={() => setSheet('payer')}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
          <Leading>
            <SoftIcon name="event" />
          </Leading>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="caption" tone="tertiary" style={{ marginBottom: 8 }}>
              {tr('expense.when')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label={tr('date.today')} selected={sameDay(day, today)} onPress={() => setDay(today)} />
              <Chip label={tr('date.yesterday')} selected={sameDay(day, yesterday)} onPress={() => setDay(yesterday)} />
              <Chip
                icon="calendar-today"
                label={isCustomDay ? formatSmartDate(day) : tr('date.pickDate')}
                selected={isCustomDay}
                onPress={() => setSheet('date')}
              />
            </View>
          </View>
        </View>
      </Card>

      {/* Participants */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.lg, marginBottom: 10 }}>
        <Text variant="h3">{tr('expense.splitBetween')}</Text>
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {people.map((p) => (
          <Chip
            key={p.id}
            label={p.id === me.id ? tr('common.you') : firstName(p.name)}
            selected={participantIds.has(p.id)}
            onPress={() => toggle(p.id)}
            leading={<Avatar name={p.name} uri={p.avatarUrl} size="xs" />}
          />
        ))}
      </View>

      <SegmentedControl
        style={{ marginTop: t.spacing.base }}
        value={splitMode}
        onChange={setSplitMode}
        options={SPLIT_MODES.map((s) => ({ value: s.value, label: tr(s.labelKey) }))}
      />
      {splitMode === 'shares' ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>
          {tr('expense.sharesHint')}
        </Text>
      ) : null}

      {/* Per-person breakdown */}
      <Card style={{ marginTop: 12 }} padding={4}>
        {participants.length === 0 ? (
          <Text tone="tertiary" style={{ padding: 12 }}>
            {tr('expense.pickOne')}
          </Text>
        ) : (
          participants.map((p, i) => {
            const share = split?.isValid ? split.splits.find((s) => s.userId === p.id)?.amount : undefined;
            const name = youOr(p);
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
                <Avatar name={p.name} uri={p.avatarUrl} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {name}
                  </Text>
                  {/* Amounts appear once there's a valid split; until then the space stays empty. */}
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
                      onPress={() => setShares((s) => ({ ...s, [p.id]: Math.max(0, sharesOf(p.id) - 1) }))}
                    />
                    <Text variant="bodyStrong" tabular align="center" style={{ minWidth: 28 }}>
                      {sharesOf(p.id)}
                    </Text>
                    <IconButton
                      icon="add"
                      variant="soft"
                      size={34}
                      accessibilityLabel={tr('expense.addShare', { name })}
                      onPress={() => setShares((s) => ({ ...s, [p.id]: Math.min(99, sharesOf(p.id) + 1) }))}
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
          })
        )}
      </Card>

      {equalEach !== undefined ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>
          {tr('expense.each', { amount: formatCurrency(equalEach, currency) })}
        </Text>
      ) : null}
      {(splitMode === 'custom' || splitMode === 'percentage') && total > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
          <Text variant="caption" tone={Math.abs(remaining) < 0.01 ? 'positive' : 'warning'} style={{ flexShrink: 1 }}>
            {Math.abs(remaining) < 0.01
              ? `✓ ${tr('expense.addsUp')}`
              : splitMode === 'custom'
                ? tr(remaining > 0 ? 'expense.leftToAssign' : 'expense.overTotal', { amount: formatCurrency(Math.abs(remaining), currency) })
                : tr(remaining > 0 ? 'expense.leftToAssign' : 'expense.over100', { amount: `${Math.abs(remaining).toFixed(1)}%` })}
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

      {/* Notes stay tucked away until wanted. */}
      {notesOpen || notes ? (
        <Input
          label={tr('expense.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={tr('expense.notesPlaceholder')}
          autoFocus={notesOpen && !notes}
          multiline
          maxLength={1000}
          containerStyle={{ marginTop: t.spacing.lg }}
        />
      ) : (
        <Button title={tr('expense.addNote')} icon="notes" variant="ghost" onPress={() => setNotesOpen(true)} style={{ marginTop: t.spacing.base, alignSelf: 'flex-start' }} />
      )}

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
