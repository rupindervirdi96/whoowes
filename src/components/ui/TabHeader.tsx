import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import Text from './Text';

/** Large title used at the top of each tab screen. */
const TabHeader: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode }> = ({ title, subtitle, right }) => {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: t.spacing.sm,
        marginBottom: t.spacing.lg,
        minHeight: 44,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="h1">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View> : null}
    </View>
  );
};

export default TabHeader;
