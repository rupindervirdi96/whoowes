import React from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLOR_SCHEMES, useTheme, type ColorThemeId } from '../theme';
import { useUIStore } from '../store/uiStore';
import { useT, type TKey } from '../i18n';
import Text from './ui/Text';
import Icon from './ui/Icon';

const NAME: Record<ColorThemeId, TKey> = {
  violet: 'theme.violet',
  ocean: 'theme.ocean',
  berry: 'theme.berry',
  lagoon: 'theme.lagoon',
  graphite: 'theme.graphite',
};

/**
 * The colour themes, each shown as a tiny balance card in its own colours
 * (in the current light or dark mode). Tapping one applies it straight away.
 */
const ThemePicker: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const current = useUIStore((s) => s.colorTheme);
  const setColorTheme = useUIStore((s) => s.setColorTheme);

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {COLOR_SCHEMES.map((s) => {
        const p = t.isDark ? s.dark : s.light;
        const selected = s.id === current;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={tr(NAME[s.id])}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync().catch(() => {});
              setColorTheme(s.id);
            }}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, opacity: pressed ? 0.8 : 1 })}
          >
            <View
              style={{
                alignSelf: 'stretch',
                padding: 3,
                borderRadius: t.radius.md + 3,
                borderWidth: 2,
                borderColor: selected ? t.colors.primary : 'transparent',
              }}
            >
              <LinearGradient
                colors={[p.heroFrom, p.heroTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: 58, borderRadius: t.radius.md, padding: 8, justifyContent: 'space-between' }}
              >
                {/* A mini balance card: an amount line and the accent "Settle up" button. */}
                <View style={{ width: '70%', height: 6, borderRadius: 3, backgroundColor: p.heroText, opacity: 0.85 }} />
                <View style={{ height: 12, borderRadius: 6, backgroundColor: p.accent }} />
              </LinearGradient>
              {selected ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: t.colors.primary,
                    borderWidth: 2,
                    borderColor: t.colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={12} color={t.colors.textOnPrimary} />
                </View>
              ) : null}
            </View>
            <Text variant="caption" tone={selected ? 'primary' : 'secondary'} weight={selected ? 'bold' : undefined} numberOfLines={1}>
              {tr(NAME[s.id])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default ThemePicker;
