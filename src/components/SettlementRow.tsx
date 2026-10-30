import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Settlement } from '../types';
import { useTheme } from '../theme';
import { formatCurrency } from '../utils/currency';
import { formatSmartDate } from '../utils/date';
import { firstName, settlementForMe } from '../utils/money';
import { useT } from '../i18n';
import Text from './ui/Text';
import Icon from './ui/Icon';
import { RowAmount } from './ui/ListRow';

/** One payment between me and someone else. Status shows as a quiet caption, not a pill. */
const SettlementRow: React.FC<{ settlement: Settlement; myId: string; divider?: boolean }> = ({ settlement: s, myId, divider }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const { outgoing, other } = settlementForMe(s, myId);
  const title = outgoing ? tr('payment.youPaid', { name: firstName(other.name) }) : tr('payment.paidYou', { name: firstName(other.name) });
  const caption =
    s.status === 'pending' ? tr('payment.pending') : s.status === 'rejected' ? tr('payment.declined') : outgoing ? tr('payment.sent') : tr('payment.received');
  const captionTone = s.status === 'pending' ? 'warning' : s.status === 'rejected' ? 'negative' : 'tertiary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${formatCurrency(s.amount, s.currency)}, ${caption}`}
      onPress={() => navigation.navigate('SettlementDetail', { settlementId: s.id })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: outgoing ? t.colors.surfaceAlt : t.colors.positiveSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={outgoing ? 'north-east' : 'south-west'} size={19} color={outgoing ? t.colors.textSecondary : t.colors.positive} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 3 }}>
          {s.note ? `${s.note} · ` : ''}
          {formatSmartDate(s.updatedAt)}
        </Text>
      </View>
      <RowAmount
        amount={formatCurrency(s.amount, s.currency)}
        tone={outgoing ? 'default' : 'positive'}
        caption={caption}
        captionTone={captionTone}
      />
      {divider ? (
        <View
          style={{ position: 'absolute', left: 54, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border }}
        />
      ) : null}
    </Pressable>
  );
};

export default SettlementRow;
