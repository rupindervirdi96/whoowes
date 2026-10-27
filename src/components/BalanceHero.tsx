import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { formatCurrency } from '../utils/currency';
import Text from './ui/Text';
import Button from './ui/Button';

interface BalanceHeroProps {
  totalOwed: number;
  totalOwes: number;
  onSettleUp: () => void;
}

/** The violet card at the top of Home: my net position and one action. */
const BalanceHero: React.FC<BalanceHeroProps> = ({ totalOwed, totalOwes, onSettleUp }) => {
  const t = useTheme();
  const net = totalOwed - totalOwes;
  const square = Math.abs(net) < 0.005 && totalOwed + totalOwes < 0.005;
  const headline = net > 0.004 ? 'You are owed' : net < -0.004 ? 'You owe' : 'All square';

  return (
    <LinearGradient
      colors={[t.colors.heroFrom, t.colors.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, padding: 22, overflow: 'hidden' }}
    >
      {/* Brand echo: two faint "owl eyes" in the corner */}
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -36, flexDirection: 'row' }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <View style={{ width: 120, height: 120, borderRadius: 60, marginLeft: -16, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </View>

      <Text variant="label" tone="heroMuted">
        {headline}
      </Text>
      <Text
        variant="display"
        tone="hero"
        tabular
        style={{ marginTop: 4 }}
        accessibilityLabel={`${headline} ${formatCurrency(Math.abs(net))}`}
      >
        {formatCurrency(Math.abs(net))}
      </Text>

      {square ? (
        <Text variant="caption" tone="heroMuted" style={{ marginTop: 6 }}>
          Nobody owes anybody. Nice.
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
          <Text variant="caption" tone="heroMuted">
            Owed to you{'  '}
            <Text variant="caption" weight="bold" color={t.brand.citrus} tabular>
              {formatCurrency(totalOwed)}
            </Text>
          </Text>
          <Text variant="caption" tone="heroMuted">
            You owe{'  '}
            <Text variant="caption" weight="bold" color="#FFC2C4" tabular>
              {formatCurrency(totalOwes)}
            </Text>
          </Text>
        </View>
      )}

      {!square ? (
        <Button title="Settle up" icon="swap-horiz" variant="accent" onPress={onSettleUp} style={{ marginTop: 20 }} fullWidth />
      ) : null}
    </LinearGradient>
  );
};

export default BalanceHero;
