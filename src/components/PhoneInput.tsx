import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { getCountries, type CountryCode } from 'libphonenumber-js';
import { useTheme } from '../theme';
import { callingCode, flag, formatAsYouType } from '../utils/phone';
import Text from './ui/Text';
import Icon from './ui/Icon';
import Input from './ui/Input';
import BottomSheet from './ui/BottomSheet';

/** Names for the countries people pick most; the rest show their ISO code. */
const NAMES: Partial<Record<CountryCode, string>> = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', IE: 'Ireland', AU: 'Australia', NZ: 'New Zealand',
  IN: 'India', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka', NP: 'Nepal', AE: 'United Arab Emirates',
  SA: 'Saudi Arabia', QA: 'Qatar', SG: 'Singapore', MY: 'Malaysia', PH: 'Philippines', ID: 'Indonesia',
  TH: 'Thailand', VN: 'Vietnam', JP: 'Japan', KR: 'South Korea', CN: 'China', HK: 'Hong Kong', TW: 'Taiwan',
  DE: 'Germany', FR: 'France', ES: 'Spain', PT: 'Portugal', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium',
  CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland',
  GR: 'Greece', TR: 'Türkiye', IL: 'Israel', EG: 'Egypt', NG: 'Nigeria', KE: 'Kenya', ZA: 'South Africa',
  MX: 'Mexico', BR: 'Brazil', AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru',
};

export const countryName = (c: CountryCode) => NAMES[c] ?? c;

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const formatted = formatAsYouType(value, country);

  const countries = useMemo(() => {
    const all = getCountries().sort((a, b) => {
      const named = Number(!!NAMES[b]) - Number(!!NAMES[a]);
      return named || countryName(a).localeCompare(countryName(b));
    });
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) return all;
    return all.filter((c) => countryName(c).toLowerCase().includes(q) || c.toLowerCase() === q || callingCode(c).slice(1).startsWith(q));
  }, [query]);

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
          accessibilityLabel={`Country: ${countryName(country)} ${callingCode(country)}`}
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
          placeholder="Phone number"
          placeholderTextColor={t.colors.textTertiary}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus={autoFocus}
          onSubmitEditing={onSubmitEditing}
          selectionColor={t.colors.primary}
          accessibilityLabel="Phone number"
          style={{ flex: 1, height: '100%', paddingHorizontal: 14, fontFamily: t.fonts.semibold, fontSize: 17, color: t.colors.text }}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="negative" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : null}

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Country">
        <Input icon="search" value={query} onChangeText={setQuery} placeholder="Search country or code" autoCorrect={false} />
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
                {countryName(item)}
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
