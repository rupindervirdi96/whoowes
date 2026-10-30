import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { getCountries, type CountryCode } from 'libphonenumber-js';
import { useTheme } from '../theme';
import { callingCode, flag, formatAsYouType } from '../utils/phone';
import { COUNTRY_TABLE } from '../i18n/countries';
import { currentLanguage, useT, type Language } from '../i18n';
import Text from './ui/Text';
import Icon from './ui/Icon';
import Input from './ui/Input';
import BottomSheet from './ui/BottomSheet';

const LANG_INDEX: Record<Language, number> = { en: 1, fr: 2, es: 3, hi: 4 };
const NAMES = new Map(COUNTRY_TABLE.map((row) => [row[0], row]));

/** Country name in the app language ("Inde", "भारत"). */
export const countryName = (c: CountryCode, lang: Language = currentLanguage()) => NAMES.get(c)?.[LANG_INDEX[lang]] ?? c;

interface PhoneInputProps {
  country: CountryCode;
  onCountryChange: (c: CountryCode) => void;
  /** National digits as typed (formatting is applied for display). */
  value: string;
  onChangeText: (digits: string) => void;
  error?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}

/** Country picker + national number, formatted as you type. */
const PhoneInput: React.FC<PhoneInputProps> = ({ country, onCountryChange, value, onChangeText, error, autoFocus, onSubmitEditing }) => {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const formatted = formatAsYouType(value, country);

  const countries = useMemo(() => {
    // The phone's own country first, then alphabetical in the app language.
    const all = getCountries().sort((a, b) => countryName(a, lang).localeCompare(countryName(b, lang), lang));
    const ordered = [country, ...all.filter((c) => c !== country)];
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) return ordered;
    return ordered.filter(
      (c) =>
        countryName(c, lang).toLowerCase().includes(q) ||
        countryName(c, 'en').toLowerCase().includes(q) ||
        c.toLowerCase() === q ||
        callingCode(c).slice(1).startsWith(q),
    );
  }, [query, lang, country]);

  return (
    <View style={{ marginBottom: t.spacing.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 56,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: error ? t.colors.negative : t.colors.border,
          backgroundColor: t.colors.surface,
        }}
      >
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={tr('phone.countryLabel', { country: countryName(country, lang), code: callingCode(country) })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: '100%' }}
        >
          <Text style={{ fontSize: 20, lineHeight: 24 }}>{flag(country)}</Text>
          <Text variant="bodyStrong">{callingCode(country)}</Text>
          <Icon name="expand-more" size={18} color={t.colors.textTertiary} />
        </Pressable>
        <View style={{ width: 1, height: 28, backgroundColor: t.colors.border }} />
        <TextInput
          value={formatted}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '');
            // Deleting a "(" or "-" leaves the digits unchanged; treat it as deleting a digit.
            onChangeText(digits === value && v.length < formatted.length ? value.slice(0, -1) : digits);
          }}
          placeholder={tr('phone.placeholder')}
          placeholderTextColor={t.colors.textTertiary}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus={autoFocus}
          onSubmitEditing={onSubmitEditing}
          selectionColor={t.colors.primary}
          accessibilityLabel={tr('phone.placeholder')}
          style={{ flex: 1, height: '100%', paddingHorizontal: 14, fontFamily: t.fonts.semibold, fontSize: 17, color: t.colors.text }}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="negative" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : null}

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title={tr('phone.country')}>
        <Input icon="search" value={query} onChangeText={setQuery} placeholder={tr('phone.searchCountry')} autoCorrect={false} />
        <FlatList
          data={countries}
          keyExtractor={(c) => c}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          initialNumToRender={20}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onCountryChange(item);
                setPickerOpen(false);
                setQuery('');
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 22, lineHeight: 26 }}>{flag(item)}</Text>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {countryName(item, lang)}
              </Text>
              <Text tone="tertiary">{callingCode(item)}</Text>
              {item === country ? <Icon name="check" size={20} color={t.colors.primary} /> : null}
            </Pressable>
          )}
        />
      </BottomSheet>
    </View>
  );
};

export default PhoneInput;
