/**
 * The action sheet behind the center "+" tab button. Lists every way to add
 * money to WhoOwes, with the AI options tagged by plan.
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUIStore } from '../store/uiStore';
import { useEntitlements } from '../hooks/useBilling';
import { useTheme } from '../theme';
import BottomSheet from './ui/BottomSheet';
import Text from './ui/Text';
import Icon from './ui/Icon';
import { PlanTag } from './ui/Badge';
import { useT } from '../i18n';

interface Option {
  key: string;
  icon: string;
  title: string;
  body: string;
  tag?: React.ReactNode;
  tint: 'primary' | 'accent' | 'positive' | 'neutral';
  onPress: () => void;
}

const AddSheet: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const open = useUIStore((s) => s.addSheetOpen);
  const groupId = useUIStore((s) => s.addSheetGroupId);
  const close = useUIStore((s) => s.closeAddSheet);
  const { can, scansLeft, plan } = useEntitlements();

  const go = (fn: () => void) => {
    close();
    // Let the sheet start closing before the next screen slides in.
    setTimeout(fn, 120);
  };

  const scanTag =
    plan === 'pro' ? null : (
      <Text variant="caption" tone={scansLeft > 0 ? 'tertiary' : 'negative'}>
        {scansLeft === Infinity ? '' : tr('add.scansLeft', { count: scansLeft })}
      </Text>
    );

  const options: Option[] = [
    {
      key: 'scan',
      icon: 'document-scanner',
      title: tr('add.scan.title'),
      body: tr('add.scan.body'),
      tag: scanTag,
      tint: 'primary',
      onPress: () => go(() => navigation.navigate('ReceiptScan', { groupId })),
    },
    {
      key: 'quick',
      icon: 'bolt',
      title: tr('add.quick.title'),
      body: tr('add.quick.body'),
      tag: can('ai_quick_add') ? null : <PlanTag plan="plus" />,
      tint: 'accent',
      onPress: () =>
        go(() => (can('ai_quick_add') ? navigation.navigate('QuickAdd', { groupId }) : navigation.navigate('Plans', { feature: 'ai_quick_add' }))),
    },
    {
      key: 'manual',
      icon: 'edit-note',
      title: tr('add.manual.title'),
      body: tr('add.manual.body'),
      tint: 'neutral',
      onPress: () => go(() => navigation.navigate('ManualExpense', { groupId })),
    },
    {
      key: 'pay',
      icon: 'swap-horiz',
      title: tr('add.pay.title'),
      body: tr('add.pay.body'),
      tint: 'positive',
      onPress: () => go(() => navigation.navigate('SettleUp', { groupId })),
    },
  ];

  const tints = {
    primary: [t.colors.primarySoft, t.colors.primary],
    accent: [t.isDark ? t.colors.accentSoft : '#EEFFB0', t.isDark ? t.colors.accent : '#4D6300'],
    positive: [t.colors.positiveSoft, t.colors.positive],
    neutral: [t.colors.surfaceAlt, t.colors.text],
  } as const;

  return (
    <BottomSheet visible={open} onClose={close} title={tr('add.title')}>
      <View style={{ gap: 4 }}>
        {options.map((o) => {
          const [bg, fg] = tints[o.tint];
          return (
            <Pressable
              key={o.key}
              accessibilityRole="button"
              onPress={o.onPress}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 12,
                borderRadius: t.radius.lg,
                backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent',
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={o.icon} size={24} color={fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{o.title}</Text>
                <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
                  {o.body}
                </Text>
              </View>
              {o.tag}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

export default AddSheet;
