import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { ALL_CURRENCIES, currencyName, deviceCurrency, getCurrencySymbol } from '../utils/currency';
import BottomSheet from './ui/BottomSheet';
import Input from './ui/Input';
import Text from './ui/Text';
import Icon from './ui/Icon';

interface CurrencyPickerProps {
  visible: boolean;
  onClose: () => void;
  value?: string;
  onSelect: (currency: string) => void;
  /** Shown first, e.g. my currency and the group's. */
  suggested?: Array<string | undefined>;
  title?: string;
}

/** Searchable list of every currency, names in the app language. */
const CurrencyPicker: React.FC<CurrencyPickerProps> = ({ visible, onClose, value, onSelect, suggested = [], title }) => {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const top = [...new Set([value, ...suggested, deviceCurrency()].filter((c): c is string => !!c && ALL_CURRENCIES.includes(c)))];
    const rest = ALL_CURRENCIES.filter((c) => !top.includes(c)).sort((a, b) => currencyName(a, lang).localeCompare(currencyName(b, lang), lang));
    const q = query.trim().toLowerCase();
    const all = [...top, ...rest];
    if (!q) return all;
    return all.filter((c) => c.toLowerCase().includes(q) || currencyName(c, lang).toLowerCase().includes(q) || currencyName(c, 'en').toLowerCase().includes(q));
  }, [value, suggested, query, lang]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title={title ?? tr('currency.pickerTitle')}>
      <Input icon="search" value={query} onChangeText={setQuery} placeholder={tr('currency.search')} autoCorrect={false} autoCapitalize="none" />
      <FlatList
        data={rows}
        keyExtractor={(c) => c}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 420 }}
        initialNumToRender={20}
        ListEmptyComponent={
          <Text tone="tertiary" style={{ paddingVertical: 16 }}>
            {tr('currency.noMatch')}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              onSelect(item);
              close();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: item === value }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
          >
            <View
              style={{
                minWidth: 48,
                height: 32,
                paddingHorizontal: 6,
                borderRadius: 10,
                backgroundColor: t.colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="label" numberOfLines={1}>
                {getCurrencySymbol(item)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {currencyName(item, lang)}
              </Text>
              <Text variant="caption" tone="tertiary">
                {item}
              </Text>
            </View>
            {item === value ? <Icon name="check" size={20} color={t.colors.primary} /> : null}
          </Pressable>
        )}
      />
    </BottomSheet>
  );
};

export default CurrencyPicker;
