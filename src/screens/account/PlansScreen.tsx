import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { BillingInterval, PlanId } from '../../types';
import { FEATURE_COPY, PLANS, yearlySavingsPercent } from '../../billing/plans';
import { useCheckout, useEntitlements, useManageSubscription } from '../../hooks/useBilling';
import { BillingService } from '../../services';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Icon from '../../components/ui/Icon';
import Badge from '../../components/ui/Badge';
import { LogoMark } from '../../components/ui/Logo';

type PaidPlan = Exclude<PlanId, 'free'>;

const PlansScreen: React.FC<RootScreenProps<'Plans'>> = ({ route, navigation }) => {
  const t = useTheme();
  const feature = route.params?.feature;
  const { plan: current } = useEntitlements();
  const checkout = useCheckout();
  const manage = useManageSubscription();
  const minPlan = feature ? FEATURE_COPY[feature].minPlan : 'pro';
  const [interval, setInterval] = useState<BillingInterval>('year');
  const [selected, setSelected] = useState<PaidPlan>(minPlan === 'plus' && current === 'free' ? 'plus' : 'pro');

  const chosen = PLANS[selected];
  const price = chosen.price[interval];
  const perMonth = interval === 'year' ? price / 12 : price;
  const isCurrent = current === selected;
  const headline = feature ? FEATURE_COPY[feature].title : 'Let AI do the math';
  const sub = feature ? FEATURE_COPY[feature].body : 'Scan receipts, add expenses by typing, and see where the money goes.';

  const buy = () =>
    checkout.mutate({ plan: selected, interval }, { onSuccess: ({ completed }) => completed && navigation.goBack() });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <LinearGradient colors={['#2A1D9E', '#120D3A']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 340 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 }}>
          <IconButton icon="close" variant="hero" accessibilityLabel="Close" onPress={() => navigation.goBack()} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <View style={{ alignItems: 'center' }}>
            <LogoMark size={64} />
            <Badge label="WhoOwes Plus & Pro" tone="accent" icon="auto-awesome" style={{ alignSelf: 'center', marginTop: 16 }} />
            <Text variant="h1" tone="hero" align="center" style={{ marginTop: 12 }}>
              {headline}
            </Text>
            <Text tone="heroMuted" align="center" style={{ marginTop: 8, maxWidth: 320 }}>
              {sub}
            </Text>
          </View>

          {/* Interval toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'center',
              marginTop: 24,
              padding: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          >
            {(['month', 'year'] as BillingInterval[]).map((iv) => (
              <Pressable
                key={iv}
                onPress={() => setInterval(iv)}
                accessibilityRole="tab"
                accessibilityState={{ selected: interval === iv }}
                style={{ paddingHorizontal: 18, height: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: interval === iv ? '#FFFFFF' : 'transparent' }}
              >
                <Text variant="label" color={interval === iv ? t.brand.ink : '#FFFFFF'}>
                  {iv === 'month' ? 'Monthly' : `Yearly · save ${yearlySavingsPercent(PLANS.pro)}%`}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Plan cards */}
          <View style={{ gap: 12, marginTop: 20 }}>
            {(['pro', 'plus'] as PaidPlan[]).map((id) => {
              const p = PLANS[id];
              const active = selected === id;
              const locked = feature && id === 'plus' && minPlan === 'pro';
              return (
                <Pressable
                  key={id}
                  disabled={!!locked}
                  onPress={() => setSelected(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active, disabled: !!locked }}
                  style={{
                    borderRadius: t.radius.xl,
                    padding: 18,
                    backgroundColor: t.colors.surface,
                    borderWidth: 2,
                    borderColor: active ? t.colors.primary : t.colors.border,
                    opacity: locked ? 0.5 : 1,
                    ...(t.elevation(2) as object),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name={active ? 'radio-button-checked' : 'radio-button-unchecked'} color={active ? t.colors.primary : t.colors.textTertiary} />
                    <Text variant="h3" style={{ flex: 1 }}>
                      {p.name}
                    </Text>
                    {p.highlight ? <Badge label="Most popular" tone="primary" /> : null}
                    {current === id ? <Badge label="Current" tone="positive" /> : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8, marginLeft: 32 }}>
                    <Text variant="h2" tabular>
                      ${p.price[interval].toFixed(2)}
                    </Text>
                    <Text tone="tertiary">/{interval === 'year' ? 'year' : 'month'}</Text>
                    {interval === 'year' ? (
                      <Text variant="caption" tone="positive" style={{ marginLeft: 'auto' }}>
                        ${(p.price.year / 12).toFixed(2)}/mo
                      </Text>
                    ) : null}
                  </View>
                  {active ? (
                    <View style={{ marginTop: 12, marginLeft: 32, gap: 8 }}>
                      {p.perks.map((perk) => (
                        <View key={perk} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                          <Icon name="check-circle" size={18} color={t.colors.positive} />
                          <Text style={{ flex: 1 }}>{perk}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text variant="caption" tone="tertiary" style={{ marginTop: 6, marginLeft: 32 }}>
                      {p.tagline}
                    </Text>
                  )}
                  {locked ? (
                    <Text variant="caption" tone="warning" style={{ marginTop: 8, marginLeft: 32 }}>
                      {FEATURE_COPY[feature!].title} needs Pro
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 16, gap: 6 }}>
            <Text variant="caption" tone="tertiary" align="center">
              Free stays free: unlimited expenses, groups and settle-ups, plus 3 AI scans a month.
            </Text>
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.background }}>
          {isCurrent ? (
            <Button title="Manage subscription" variant="secondary" size="lg" fullWidth loading={manage.isPending} onPress={() => manage.mutate()} />
          ) : (
            <Button
              title={`Get ${chosen.name} · $${perMonth.toFixed(2)}/mo`}
              variant="primary"
              size="lg"
              fullWidth
              loading={checkout.isPending}
              onPress={buy}
            />
          )}
          <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: 8 }}>
            {BillingService.isDemo
              ? 'Demo mode — no card needed, nothing is charged.'
              : `Billed ${interval === 'year' ? 'yearly' : 'monthly'} via Stripe. Cancel anytime from Account → Manage billing.`}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default PlansScreen;
