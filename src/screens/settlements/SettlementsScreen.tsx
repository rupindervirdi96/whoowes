import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { SettlementStatus } from '../../types';
import { useSettlements } from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/currency';
import { orderCurrencies } from '../../utils/balanceEngine';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useT, type TKey } from '../../i18n';
import type { Settlement } from '../../types';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import SettlementRow from '../../components/SettlementRow';

type Filter = 'all' | SettlementStatus;

const FILTER_LABELS: Record<Filter, TKey> = {
  all: 'common.all',
  confirmed: 'paymentDetail.confirmed',
  pending: 'payment.pending',
  rejected: 'payment.declined',
};

/** Totals per currency, never added across currencies. */
function sumByCurrency(list: Settlement[], preferred: string) {
  const sums = new Map<string, number>();
  for (const s of list) sums.set(s.currency, (sums.get(s.currency) ?? 0) + s.amount);
  return orderCurrencies(sums.keys(), preferred, (c) => sums.get(c)!).map((currency) => ({ currency, amount: sums.get(currency)! }));
}

const SettlementsScreen: React.FC<RootScreenProps<'Settlements'>> = ({ navigation }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const q = useSettlements();
  const [filter, setFilter] = useState<Filter>('all');
  const all = q.data ?? [];

  const toConfirm = all.filter((s) => s.status === 'pending' && s.toUserId === me.id);
  const waiting = all.filter((s) => s.status === 'pending' && s.fromUserId === me.id);
  const history = useMemo(() => all.filter((s) => filter === 'all' || s.status === filter), [all, filter]);

  const sent = sumByCurrency(all.filter((s) => s.fromUserId === me.id && s.status === 'confirmed'), myCurrency);
  const received = sumByCurrency(all.filter((s) => s.toUserId === me.id && s.status === 'confirmed'), myCurrency);
  const orZero = (list: Array<{ currency: string; amount: number }>) => (list.length ? list : [{ currency: myCurrency, amount: 0 }]);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch} footer={<Button title={tr('add.pay.title')} icon="add" size="lg" fullWidth onPress={() => navigation.navigate('SettleUp')} />}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card variant="alt" padding={14} style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary">
            {tr('payments.youPaid')}
          </Text>
          {orZero(sent).map((x) => (
            <Text key={x.currency} variant="h3" tabular>
              {formatCurrency(x.amount, x.currency)}
            </Text>
          ))}
        </Card>
        <Card variant="alt" padding={14} style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary">
            {tr('payments.youReceived')}
          </Text>
          {orZero(received).map((x) => (
            <Text key={x.currency} variant="h3" tone="positive" tabular>
              {formatCurrency(x.amount, x.currency)}
            </Text>
          ))}
        </Card>
      </View>

      {toConfirm.length ? (
        <>
          <SectionHeader title={`${tr('payments.toConfirm')} · ${toConfirm.length}`} />
          <Card padding={6} style={{ paddingHorizontal: 12 }}>
            {toConfirm.map((s) => (
              <SettlementRow key={s.id} settlement={s} myId={me.id} />
            ))}
          </Card>
        </>
      ) : null}
      {waiting.length ? (
        <>
          <SectionHeader title={tr('payments.waitingOnThem')} />
          <Card padding={6} style={{ paddingHorizontal: 12 }}>
            {waiting.map((s) => (
              <SettlementRow key={s.id} settlement={s} myId={me.id} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title={tr('payments.history')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {(['all', 'confirmed', 'pending', 'rejected'] as Filter[]).map((f) => (
          <Chip key={f} label={tr(FILTER_LABELS[f])} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      {q.isLoading ? (
        <SkeletonList />
      ) : history.length === 0 ? (
        <EmptyState emoji="💸" title={tr('payments.empty.title')} body={tr('payments.empty.body')} />
      ) : (
        <Card padding={6} style={{ paddingHorizontal: 12, marginBottom: t.spacing.base }}>
          {history.map((s) => (
            <SettlementRow key={s.id} settlement={s} myId={me.id} />
          ))}
        </Card>
      )}
    </Screen>
  );
};

export default SettlementsScreen;
