import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { QuickAddDraft } from '../../types';
import { useCurrentUser } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';
import { useGroups } from '../../hooks/useGroups';
import { useCreateExpense } from '../../hooks/useExpenses';
import { useQuickAdd } from '../../hooks/useAI';
import { useEntitlements } from '../../hooks/useBilling';
import { calculateSplit } from '../../utils/splitEngine';
import { currencyDecimals, formatCurrency } from '../../utils/currency';
import { firstName } from '../../utils/money';
import { categoryLabel } from '../../constants';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useT, type TKey } from '../../i18n';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';
import CategoryIcon from '../../components/ui/CategoryIcon';
import { PlanTag } from '../../components/ui/Badge';

const EXAMPLES: TKey[] = ['quickAdd.example1', 'quickAdd.example2', 'quickAdd.example3', 'quickAdd.example4'];

const QuickAddScreen: React.FC<RootScreenProps<'QuickAdd'>> = ({ route, navigation }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const { data: friends = [] } = useFriends();
  const { data: groups = [] } = useGroups();
  const { can } = useEntitlements();
  const quickAdd = useQuickAdd();
  const create = useCreateExpense();
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);

  const people = [me, ...friends.map((f) => f.friendUser), ...groups.flatMap((g) => g.members.map((m) => m.user))].filter(
    (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
  );
  const byId = (id: string) => people.find((p) => p.id === id);

  const parse = () => {
    if (!text.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const groupHint = route.params?.groupId;
    // Amounts without a currency mean the group's currency, else mine.
    const currency = groups.find((g) => g.id === groupHint)?.currency ?? myCurrency;
    quickAdd.mutate(
      { text: text.trim(), ctx: { me, people, groups, currency, today } },
      { onSuccess: (d) => setDraft({ ...d, groupId: d.groupId ?? groupHint }) },
    );
  };

  const participants = draft ? draft.participantIds.map(byId).filter((p): p is NonNullable<typeof p> => !!p) : [];
  const split =
    draft && draft.amount > 0 && participants.length
      ? draft.splitType === 'custom' && draft.customAmounts
        ? calculateSplit({
            type: 'custom',
            total: draft.amount,
            paidBy: draft.paidBy,
            assignments: participants.map((p) => ({ userId: p.id, user: p, amount: draft.customAmounts?.[p.id] ?? 0 })),
          })
        : calculateSplit({
            type: 'equal',
            total: draft.amount,
            paidBy: draft.paidBy,
            decimals: currencyDecimals(draft.currency),
            participants: participants.map((p) => ({ userId: p.id, user: p })),
          })
      : null;

  const save = () => {
    if (!draft || !split?.isValid) return;
    create.mutate(
      {
        title: draft.title,
        amount: draft.amount,
        currency: draft.currency,
        category: draft.category,
        paidBy: draft.paidBy,
        splitType: draft.splitType,
        splits: split.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
        groupId: draft.groupId,
        date: draft.date ? new Date(draft.date).toISOString() : undefined,
      },
      { onSuccess: () => navigation.goBack() },
    );
  };

  if (!can('ai_quick_add')) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', paddingTop: t.spacing['2xl'] }}>
          <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: t.brand.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bolt" size={36} color={t.brand.citrus} />
          </View>
          <Text variant="h2" align="center" style={{ marginTop: t.spacing.base }}>
            {tr('quickAdd.locked.title')}
          </Text>
          <Text tone="secondary" align="center" style={{ marginTop: 8, maxWidth: 300 }}>
            {tr('quickAdd.locked.body')}
          </Text>
          <PlanTag plan="plus" style={{ alignSelf: 'center', marginTop: 12 }} />
          <Button title={tr('common.seePlans')} variant="pro" size="lg" style={{ marginTop: t.spacing.xl }} onPress={() => navigation.replace('Plans', { feature: 'ai_quick_add' })} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        draft ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              title={tr('quickAdd.editDetails')}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => navigation.replace('ManualExpense', { draft })}
            />
            <Button title={tr('common.save')} icon="check" style={{ flex: 1 }} disabled={!split?.isValid} loading={create.isPending} onPress={save} />
          </View>
        ) : (
          <Button title={tr('quickAdd.understand')} icon="auto-awesome" size="lg" fullWidth disabled={!text.trim()} loading={quickAdd.isPending} onPress={parse} />
        )
      }
    >
      <Text variant="h2">{tr('quickAdd.title')}</Text>
      <Text tone="secondary" style={{ marginTop: 4, marginBottom: t.spacing.base }}>
        {tr('quickAdd.subtitle')}
      </Text>

      <View
        style={{
          borderRadius: t.radius.lg,
          borderWidth: 1.5,
          borderColor: t.colors.primary,
          backgroundColor: t.colors.surface,
          padding: 14,
          minHeight: 120,
        }}
      >
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (draft) setDraft(null);
          }}
          placeholder={tr('quickAdd.placeholder')}
          placeholderTextColor={t.colors.textTertiary}
          multiline
          autoFocus
          style={{ fontFamily: t.fonts.medium, fontSize: 18, lineHeight: 26, color: t.colors.text, minHeight: 90, textAlignVertical: 'top' }}
          accessibilityLabel={tr('quickAdd.describe')}
        />
      </View>

      {!draft ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {EXAMPLES.map((key) => (
            <Chip key={key} label={tr(key)} onPress={() => setText(tr(key))} />
          ))}
        </View>
      ) : (
        <Card style={{ marginTop: t.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <CategoryIcon category={draft.category} size={48} />
            <View style={{ flex: 1 }}>
              <Text variant="h3" numberOfLines={1}>
                {draft.title}
              </Text>
              <Text variant="caption" tone="tertiary">
                {categoryLabel(draft.category)}
                {draft.groupId ? ` · ${groups.find((g) => g.id === draft.groupId)?.name ?? ''}` : ''}
              </Text>
            </View>
            <Text variant="h2" tabular>
              {formatCurrency(draft.amount, draft.currency)}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 14 }} />
          <Text variant="caption" tone="tertiary" style={{ marginBottom: 8 }}>
            {draft.paidBy === me.id ? tr('expense.youPaid') : tr('expense.theyPaid', { name: firstName(byId(draft.paidBy)?.name ?? tr('quickAdd.someone')) })} ·{' '}
            {tr(draft.splitType === 'equal' ? 'quickAdd.splitEqually' : 'quickAdd.splitByAmount')}
          </Text>
          {(split?.splits ?? []).map((s) => (
            <View key={s.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <Avatar name={s.user.name} size="xs" />
              <Text style={{ flex: 1 }}>{s.userId === me.id ? tr('common.you') : s.user.name}</Text>
              <Text variant="bodyStrong" tabular>
                {formatCurrency(s.amount, draft.currency)}
              </Text>
            </View>
          ))}
          {draft.note ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              <Icon name="info-outline" size={16} color={t.colors.warning} />
              <Text variant="caption" tone="warning" style={{ flex: 1 }}>
                {draft.note}
              </Text>
            </View>
          ) : null}
        </Card>
      )}
    </Screen>
  );
};

export default QuickAddScreen;
