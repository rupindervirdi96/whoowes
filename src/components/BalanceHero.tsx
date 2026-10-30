import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import type { CurrencyTotals } from '../types';
import { formatCurrency } from '../utils/currency';
import Text from './ui/Text';
import Button from './ui/Button';

interface BalanceHeroProps {
  /** My totals per currency, main currency first. */
  totals: CurrencyTotals[];
  /** Shown when there are no balances at all. */
  currency: string;
  onSettleUp: () => void;
}

/**
 * The violet card at the top of Home: my net position and one action. The main
 * currency is the big number; other currencies are listed under it, never added in.
 */
const BalanceHero: React.FC<BalanceHeroProps> = ({ totals, currency, onSettleUp }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const main = totals[0] ?? { currency, totalOwed: 0, totalOwes: 0, netBalance: 0 };
  const others = totals.slice(1).filter((x) => Math.abs(x.netBalance) >= 0.005 || x.totalOwed + x.totalOwes >= 0.005);
  const net = main.netBalance;
  const square = totals.length === 0 || totals.every((x) => x.totalOwed + x.totalOwes < 0.005);
  const headline = net > 0.004 ? tr('hero.owed') : net < -0.004 ? tr('hero.owe') : tr('hero.square');
  const money = (n: number, c = main.currency) => formatCurrency(n, c);

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
      <Text variant="display" tone="hero" tabular style={{ marginTop: 4 }} accessibilityLabel={`${headline} ${money(Math.abs(net))}`}>
        {money(Math.abs(net))}
      </Text>

      {square ? (
        <Text variant="caption" tone="heroMuted" style={{ marginTop: 6 }}>
          {tr('hero.nobodyOwes')}
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 4, marginTop: 8 }}>
            <Text variant="caption" tone="heroMuted">
              {tr('hero.owedToYou')}
              {'  '}
              <Text variant="caption" weight="bold" color={t.brand.citrus} tabular>
                {money(main.totalOwed)}
              </Text>
            </Text>
            <Text variant="caption" tone="heroMuted">
              {tr('hero.youOwe')}
              {'  '}
              <Text variant="caption" weight="bold" color="#FFC2C4" tabular>
                {money(main.totalOwes)}
              </Text>
            </Text>
          </View>
          {others.map((o) => (
            <Text key={o.currency} variant="caption" tone="heroMuted" style={{ marginTop: 6 }}>
              {o.netBalance > 0 ? tr('hero.alsoOwed') : tr('hero.alsoOwe')}{' '}
              <Text variant="caption" weight="bold" color={o.netBalance > 0 ? t.brand.citrus : '#FFC2C4'} tabular>
                {money(Math.abs(o.netBalance), o.currency)}
              </Text>
            </Text>
          ))}
        </>
      )}

      {!square ? <Button title={tr('hero.settleUp')} icon="swap-horiz" variant="accent" onPress={onSettleUp} style={{ marginTop: 20 }} fullWidth /> : null}
    </LinearGradient>
  );
};

export default BalanceHero;
