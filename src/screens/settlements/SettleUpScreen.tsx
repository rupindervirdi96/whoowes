import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useBalances } from '../../hooks/useBalances';
import { useFriends, useRemind } from '../../hooks/useFriends';
import { useCreateSettlement } from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/currency';
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

const METHODS = ['Cash', 'Venmo', 'PayPal', 'Bank transfer', 'Other'];

const SettleUpScreen: React.FC<RootScreenProps<'SettleUp'>> = ({ route, navigation }) => {
  const params = route.params ?? {};
  const t = useTheme();
  const me = useCurrentUser()!;
  const { data: balanceData } = useBalances();
  const { data: friends = [] } = useFriends();
  const create = useCreateSettlement();
  const remind = useRemind();

  const balances = balanceData?.balances ?? [];
  const [personId, setPersonId] = useState<string | undefined>(params.userId);
  const initialNet = balances.find((b) => b.userId === params.userId)?.netBalance ?? 0;
  // 'pay' = I'm logging money I sent. 'got' = they paid me, which they log themselves.
  const [direction, setDirection] = useState<'pay' | 'got'>(initialNet > 0 ? 'got' : 'pay');
  const [amount, setAmount] = useState(params.amount ? params.amount.toFixed(2) : '');
  const [method, setMethod] = useState<string>();
  const [note, setNote] = useState('');

  const people = useMemo(() => {
    const map = new Map(friends.map((f) => [f.friendId, f.friendUser]));
    balances.forEach((b) => map.set(b.userId, b.user));
    return Array.from(map.values());
  }, [friends, balances]);
  const person = people.find((p) => p.id === personId);
  const net = balances.find((b) => b.userId === personId)?.netBalance ?? 0;
  const value = parseFloat(amount) || 0;

  const pick = (id: string) => {
    setPersonId(id);
    const n = balances.find((b) => b.userId === id)?.netBalance ?? 0;
    setDirection(n > 0 ? 'got' : 'pay');
    if (n !== 0) setAmount(Math.abs(n).toFixed(2));
  };

  // Step 1: choose who
  if (!person) {
    const iOwe = balances.filter((b) => b.netBalance < 0);
    const owesMe = balances.filter((b) => b.netBalance > 0);
    const settledPeople = people.filter((p) => !balances.some((b) => b.userId === p.id));
    return (
      <Screen>
        {balances.length === 0 ? (
          <EmptyState emoji="🎉" title="You’re all settled up" body="No open balances with anyone. You can still record a payment to a friend below." />
        ) : null}
        {iOwe.length ? (
          <>
            <SectionHeader title="You owe" style={{ marginTop: 0 }} />
            <ListCard>
              {iOwe.map((b, i) => (
                <ListRow
                  key={b.userId}
                  leading={<Avatar name={b.user.name} uri={b.user.avatarUrl} />}
                  title={b.user.name}
                  divider={i < iOwe.length - 1}
                  onPress={() => pick(b.userId)}
                  trailing={<RowAmount amount={formatCurrency(b.owes)} tone="negative" />}
                  chevron
                />
              ))}
            </ListCard>
          </>
        ) : null}
        {owesMe.length ? (
          <>
            <SectionHeader title="Owes you" style={iOwe.length ? undefined : { marginTop: 0 }} />
            <ListCard>
              {owesMe.map((b, i) => (
                <ListRow
                  key={b.userId}
                  leading={<Avatar name={b.user.name} uri={b.user.avatarUrl} />}
                  title={b.user.name}
                  divider={i < owesMe.length - 1}
                  onPress={() => pick(b.userId)}
                  trailing={<RowAmount amount={formatCurrency(b.owed)} tone="positive" />}
                  chevron
                />
              ))}
            </ListCard>
          </>
        ) : null}
        {settledPeople.length ? (
          <>
            <SectionHeader title="Everyone else" />
            <ListCard>
              {settledPeople.map((p, i) => (
                <ListRow
                  key={p.id}
                  leading={<Avatar name={p.name} uri={p.avatarUrl} />}
                  title={p.name}
                  subtitle="Settled up"
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

  const submit = () => {
    if (value <= 0) return;
    const fullNote = [method, note.trim()].filter(Boolean).join(' · ') || undefined;
    // The payer logs the payment; the person who received it confirms it.
    create.mutate(
      { toUserId: person.id, amount: value, note: fullNote, groupId: params.groupId },
      { onSuccess: () => navigation.goBack() },
    );
  };

  return (
    <Screen
      footer={
        direction === 'pay' ? (
          <Button title={`Record ${value > 0 ? formatCurrency(value) : 'payment'}`} icon="check" size="lg" fullWidth disabled={value <= 0} loading={create.isPending} onPress={submit} />
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
          {direction === 'pay' ? `You pay ${firstName(person.name)}` : `${firstName(person.name)} paid you`}
        </Text>
        {net !== 0 ? (
          <Text variant="caption" tone={net > 0 ? 'positive' : 'negative'}>
            {net > 0 ? `${firstName(person.name)} owes you ${formatCurrency(net)}` : `You owe ${formatCurrency(-net)}`}
          </Text>
        ) : null}
      </View>

      <SegmentedControl
        style={{ marginTop: t.spacing.base }}
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'pay', label: 'I paid them' },
          { value: 'got', label: 'They paid me' },
        ]}
      />

      {direction === 'got' ? (
        <Card variant="alt" style={{ marginTop: t.spacing.base }}>
          <Text variant="bodyStrong">Ask {firstName(person.name)} to record it</Text>
          <Text tone="secondary" style={{ marginTop: 4 }}>
            Payments are logged by whoever sent the money, then confirmed by whoever received it — so nobody can mark a debt paid on
            someone else’s behalf. You’ll get a “Did you get it?” prompt as soon as they log it.
          </Text>
          <Button
            title={`Nudge ${firstName(person.name)}`}
            icon="notifications-active"
            variant="secondary"
            style={{ marginTop: 12 }}
            loading={remind.isPending}
            onPress={() => remind.mutate({ userId: person.id, name: person.name }, { onSuccess: () => navigation.goBack() })}
          />
        </Card>
      ) : (
        <>
          <AmountInput value={amount} onChangeText={setAmount} autoFocus={!params.amount} />
          {net < 0 && value !== Math.abs(net) ? (
            <View style={{ alignItems: 'center', marginTop: -6, marginBottom: 8 }}>
              <Chip label={`Full amount · ${formatCurrency(-net)}`} onPress={() => setAmount((-net).toFixed(2))} />
            </View>
          ) : null}
          <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
            How did you pay?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: t.spacing.base }}>
            {METHODS.map((m) => (
              <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(method === m ? undefined : m)} />
            ))}
          </View>
          <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Rent for November" maxLength={200} />
          <Card variant="alt" padding={12} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="verified-user" size={18} color={t.colors.primary} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              WhoOwes doesn’t move money. {firstName(person.name)} confirms they got it, then your balance updates.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
};

export default SettleUpScreen;
