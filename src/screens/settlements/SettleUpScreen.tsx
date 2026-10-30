import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useBalances } from '../../hooks/useBalances';
import { useFriends, useRemind } from '../../hooks/useFriends';
import { useCreateSettlement } from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useGroup } from '../../hooks/useGroups';
import { useT, type TKey } from '../../i18n';
import { amountToInput, formatCurrency, parseAmount } from '../../utils/currency';
import { firstName } from '../../utils/money';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Avatar from '../../components/ui/Avatar';
import AmountInput from '../../components/ui/AmountInput';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card, { ListCard } from '../../components/ui/Card';
import Chip, { SegmentedControl } from '../../components/ui/Chip';
import Icon from '../../components/ui/Icon';
import ListRow, { RowAmount, SectionHeader } from '../../components/ui/ListRow';
import EmptyState from '../../components/ui/EmptyState';
import CurrencyPicker from '../../components/CurrencyPicker';

/** How people paid. Stored in the note as typed, so labels are translated at display time only. */
const METHODS: Array<{ id: string; key: TKey }> = [
  { id: 'cash', key: 'settle.method.cash' },
  { id: 'transfer', key: 'settle.method.bank' },
  { id: 'app', key: 'settle.method.app' },
  { id: 'other', key: 'settle.method.other' },
];

const SettleUpScreen: React.FC<RootScreenProps<'SettleUp'>> = ({ route, navigation }) => {
  const params = route.params ?? {};
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const { data: group } = useGroup(params.groupId ?? '');
  const { data: balanceData } = useBalances();
  const { data: friends = [] } = useFriends();
  const create = useCreateSettlement();
  const remind = useRemind();

  const balances = balanceData?.balances ?? [];
  const fallbackCurrency = group?.currency ?? myCurrency;

  const balanceFor = (userId?: string, currency?: string) => balances.find((b) => b.userId === userId && b.currency === currency);
  const firstBalanceFor = (userId?: string) =>
    (params.currency ? balanceFor(userId, params.currency) : undefined) ?? balances.find((b) => b.userId === userId);

  const [personId, setPersonId] = useState<string | undefined>(params.userId);
  const initial = firstBalanceFor(params.userId);
  const [currency, setCurrency] = useState<string>(params.currency ?? initial?.currency ?? fallbackCurrency);
  const initialNet = balanceFor(params.userId, currency)?.netBalance ?? 0;
  // 'pay' = I'm logging money I sent. 'got' = they paid me, which they log themselves.
  const [direction, setDirection] = useState<'pay' | 'got'>(initialNet > 0 ? 'got' : 'pay');
  const [amount, setAmount] = useState(params.amount ? amountToInput(params.amount, currency) : '');
  const [method, setMethod] = useState<string>();
  const [note, setNote] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const people = useMemo(() => {
    const map = new Map(friends.map((f) => [f.friendId, f.friendUser]));
    balances.forEach((b) => map.set(b.userId, b.user));
    return Array.from(map.values());
  }, [friends, balances]);
  const person = people.find((p) => p.id === personId);
  const personBalances = balances.filter((b) => b.userId === personId);
  const net = balanceFor(personId, currency)?.netBalance ?? 0;
  const value = parseAmount(amount);

  const pick = (id: string, c?: string) => {
    const b = c ? balanceFor(id, c) : balances.find((x) => x.userId === id);
    setPersonId(id);
    const nextCurrency = b?.currency ?? fallbackCurrency;
    setCurrency(nextCurrency);
    const n = b?.netBalance ?? 0;
    setDirection(n > 0 ? 'got' : 'pay');
    setAmount(n !== 0 ? amountToInput(Math.abs(n), nextCurrency) : '');
  };

  const switchCurrency = (c: string) => {
    setCurrency(c);
    const n = balanceFor(personId, c)?.netBalance ?? 0;
    if (n < 0) setAmount(amountToInput(-n, c));
    else if (n > 0) setDirection('got');
  };

  // Step 1: choose who
  if (!person) {
    const iOwe = balances.filter((b) => b.netBalance < 0);
    const owesMe = balances.filter((b) => b.netBalance > 0);
    const settledPeople = people.filter((p) => !balances.some((b) => b.userId === p.id));
    return (
      <Screen>
        {balances.length === 0 ? <EmptyState emoji="🎉" title={tr('settle.allSettled.title')} body={tr('settle.allSettled.body')} /> : null}
        {iOwe.length ? (
          <>
            <SectionHeader title={tr('balance.youOweTitle')} style={{ marginTop: 0 }} />
            <ListCard>
              {iOwe.map((b, i) => (
                <ListRow
                  key={`${b.userId}|${b.currency}`}
                  leading={<Avatar name={b.user.name} uri={b.user.avatarUrl} />}
                  title={b.user.name}
                  divider={i < iOwe.length - 1}
                  onPress={() => pick(b.userId, b.currency)}
                  trailing={<RowAmount amount={formatCurrency(b.owes, b.currency)} tone="negative" />}
                  chevron
                />
              ))}
            </ListCard>
          </>
        ) : null}
        {owesMe.length ? (
          <>
            <SectionHeader title={tr('balance.owesYouTitle')} style={iOwe.length ? undefined : { marginTop: 0 }} />
            <ListCard>
              {owesMe.map((b, i) => (
                <ListRow
                  key={`${b.userId}|${b.currency}`}
                  leading={<Avatar name={b.user.name} uri={b.user.avatarUrl} />}
                  title={b.user.name}
                  divider={i < owesMe.length - 1}
                  onPress={() => pick(b.userId, b.currency)}
                  trailing={<RowAmount amount={formatCurrency(b.owed, b.currency)} tone="positive" />}
                  chevron
                />
              ))}
            </ListCard>
          </>
        ) : null}
        {settledPeople.length ? (
          <>
            <SectionHeader title={tr('settle.everyoneElse')} />
            <ListCard>
              {settledPeople.map((p, i) => (
                <ListRow
                  key={p.id}
                  leading={<Avatar name={p.name} uri={p.avatarUrl} />}
                  title={p.name}
                  subtitle={tr('common.settledUp')}
                  divider={i < settledPeople.length - 1}
                  onPress={() => pick(p.id)}
                  chevron
                />
              ))}
            </ListCard>
          </>
        ) : null}
      </Screen>
    );
  }

  const name = firstName(person.name);

  const submit = () => {
    if (value <= 0) return;
    const methodLabel = method ? tr(METHODS.find((m) => m.id === method)!.key) : undefined;
    const fullNote = [methodLabel, note.trim()].filter(Boolean).join(' · ') || undefined;
    // The payer logs the payment; the person who received it confirms it.
    create.mutate(
      { toUserId: person.id, amount: value, currency, note: fullNote, groupId: params.groupId },
      { onSuccess: () => navigation.goBack() },
    );
  };

  return (
    <Screen
      footer={
        direction === 'pay' ? (
          <Button
            title={value > 0 ? tr('settle.recordAmount', { amount: formatCurrency(value, currency) }) : tr('settle.recordPayment')}
            icon="check"
            size="lg"
            fullWidth
            disabled={value <= 0}
            loading={create.isPending}
            onPress={submit}
          />
        ) : undefined
      }
    >
      <View style={{ alignItems: 'center', marginTop: t.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={me.name} size="lg" />
          <Icon name="arrow-forward" size={26} color={t.colors.textTertiary} />
          <Avatar name={person.name} size="lg" />
        </View>
        <Text variant="bodyLg" style={{ marginTop: 12 }}>
          {direction === 'pay' ? tr('settle.youPay', { name }) : tr('payment.paidYou', { name })}
        </Text>
        {net !== 0 ? (
          <Text variant="caption" tone={net > 0 ? 'positive' : 'negative'}>
            {net > 0
              ? tr('settle.owesYouAmount', { name, amount: formatCurrency(net, currency) })
              : tr('settle.youOweAmount', { amount: formatCurrency(-net, currency) })}
          </Text>
        ) : null}
      </View>

      {/* Someone I have balances with in several currencies: pick which one this settles. */}
      {personBalances.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: t.spacing.base }}>
          {personBalances.map((b) => (
            <Chip key={b.currency} label={formatCurrency(Math.abs(b.netBalance), b.currency)} selected={b.currency === currency} onPress={() => switchCurrency(b.currency)} />
          ))}
        </View>
      ) : null}

      <SegmentedControl
        style={{ marginTop: t.spacing.base }}
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'pay', label: tr('settle.iPaid') },
          { value: 'got', label: tr('settle.theyPaid') },
        ]}
      />

      {direction === 'got' ? (
        <Card variant="alt" style={{ marginTop: t.spacing.base }}>
          <Text variant="bodyStrong">{tr('settle.askToRecord', { name })}</Text>
          <Text tone="secondary" style={{ marginTop: 4 }}>
            {tr('settle.askToRecordBody')}
          </Text>
          <Button
            title={tr('settle.nudge', { name })}
            icon="notifications-active"
            variant="secondary"
            style={{ marginTop: 12 }}
            loading={remind.isPending}
            onPress={() =>
              remind.mutate(
                { userId: person.id, name: person.name, amount: net > 0 ? net : undefined, currency: net > 0 ? currency : undefined },
                { onSuccess: () => navigation.goBack() },
              )
            }
          />
        </Card>
      ) : (
        <>
          <AmountInput value={amount} onChangeText={setAmount} currency={currency} onCurrencyPress={() => setPickerOpen(true)} autoFocus={!params.amount} />
          {net < 0 && value !== Math.abs(net) ? (
            <View style={{ alignItems: 'center', marginTop: -6, marginBottom: 8 }}>
              <Chip label={tr('settle.fullAmount', { amount: formatCurrency(-net, currency) })} onPress={() => setAmount(amountToInput(-net, currency))} />
            </View>
          ) : null}
          <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
            {tr('settle.howDidYouPay')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: t.spacing.base }}>
            {METHODS.map((m) => (
              <Chip key={m.id} label={tr(m.key)} selected={method === m.id} onPress={() => setMethod(method === m.id ? undefined : m.id)} />
            ))}
          </View>
          <Input label={tr('settle.note')} value={note} onChangeText={setNote} placeholder={tr('settle.notePlaceholder')} maxLength={200} />
          <Card variant="alt" padding={12} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="verified-user" size={18} color={t.colors.primary} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              {tr('settle.noMoneyMoves', { name })}
            </Text>
          </Card>
        </>
      )}

      <CurrencyPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={currency}
        onSelect={switchCurrency}
        suggested={[...personBalances.map((b) => b.currency), group?.currency, myCurrency]}
      />
    </Screen>
  );
};

export default SettleUpScreen;
