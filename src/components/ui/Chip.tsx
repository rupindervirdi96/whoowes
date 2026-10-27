import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import Text from './Text';
import Icon from './Icon';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const Chip: React.FC<ChipProps> = ({ label, selected, onPress, icon, leading, style }) => {
  const t = useTheme();
  const c = t.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 38,
          paddingLeft: leading ? 4 : 14,
          paddingRight: 14,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: selected ? c.primary : c.border,
          backgroundColor: selected ? c.primarySoft : c.surface,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {leading}
      {icon ? <Icon name={icon} size={16} color={selected ? c.primary : c.textSecondary} /> : null}
      <Text variant="label" color={selected ? c.primary : c.text}>
        {label}
      </Text>
      {selected && leading ? <Icon name="check" size={14} color={c.primary} /> : null}
    </Pressable>
  );
};

/** Horizontal set of mutually exclusive options. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        { flexDirection: 'row', backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.md, padding: 4 },
        style,
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              height: 38,
              borderRadius: t.radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? t.colors.surface : 'transparent',
              ...(active ? (t.elevation(1) as object) : null),
            }}
          >
            <Text variant="label" tone={active ? 'default' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default Chip;
