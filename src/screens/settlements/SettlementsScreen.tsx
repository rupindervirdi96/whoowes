import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { SettlementStatus } from '../../types';
import { useSettlements } from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/currency';
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

const SettlementsScreen: React.FC<RootScreenProps<'Settlements'>> = ({ navigation }) => {
  const t = useTheme();
  const me = useCurrentUser()!;
  const q = useSettlements();
  const [filter, setFilter] = useState<Filter>('all');
  const all = q.data ?? [];

  const toConfirm = all.filter((s) => s.status === 'pending' && s.toUserId === me.id);
  const waiting = all.filter((s) => s.status === 'pending' && s.fromUserId === me.id);
  const history = useMemo(() => all.filter((s) => filter === 'all' || s.status === filter), [all, filter]);

  const sentTotal = all.filter((s) => s.fromUserId === me.id && s.status === 'confirmed').reduce((a, s) => a + s.amount, 0);
  const receivedTotal = all.filter((s) => s.toUserId === me.id && s.status === 'confirmed').reduce((a, s) => a + s.amount, 0);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch} footer={<Button title="Record a payment" icon="add" size="lg" fullWidth onPress={() => navigation.navigate('SettleUp')} />}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card variant="alt" padding={14} style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary">
            You’ve paid
          </Text>
          <Text variant="h3" tabular>
            {formatCurrency(sentTotal)}
          </Text>
        </Card>
        <Card variant="alt" padding={14} style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary">
            You’ve received
          </Text>
          <Text variant="h3" tone="positive" tabular>
            {formatCurrency(receivedTotal)}
          </Text>
        </Card>
      </View>

      {toConfirm.length ? (
        <>
          <SectionHeader title={`To confirm · ${toConfirm.length}`} />
          <Card padding={6} style={{ paddingHorizontal: 12 }}>
            {toConfirm.map((s) => (
              <SettlementRow key={s.id} settlement={s} myId={me.id} />
            ))}
          </Card>
        </>
      ) : null}
      {waiting.length ? (
        <>
          <SectionHeader title="Waiting on them" />
          <Card padding={6} style={{ paddingHorizontal: 12 }}>
            {waiting.map((s) => (
              <SettlementRow key={s.id} settlement={s} myId={me.id} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="History" />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {(['all', 'confirmed', 'pending', 'rejected'] as Filter[]).map((f) => (
          <Chip key={f} label={f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      {q.isLoading ? (
        <SkeletonList />
      ) : history.length === 0 ? (
        <EmptyState emoji="💸" title="No payments yet" body="When you settle up with someone it shows up here." />
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
