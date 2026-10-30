import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CountryCode } from 'libphonenumber-js';
import { AuthStackParamList } from '../../types/navigation';
import { useLogin, useStartPhoneSignIn } from '../../hooks/useAuth';
import { deviceCountry, toE164 } from '../../utils/phone';
import { LEGAL_URLS, USE_MOCK_API } from '../../config';
import { useTheme } from '../../theme';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import PhoneInput from '../../components/PhoneInput';
import { LogoMark } from '../../components/ui/Logo';
import { LANGUAGES, useLanguageStore, useT } from '../../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

/** First screen: sign in or sign up with a phone number. */
const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const t = useTheme();
  const { t: tr, tRich, lang } = useT();
  const setLanguage = useLanguageStore((s) => s.setPreference);
  const [country, setCountry] = useState<CountryCode>(deviceCountry);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string>();
  const start = useStartPhoneSignIn();
  const demo = useLogin();

  const submit = () => {
    const phone = toE164(digits, country);
    if (!phone) {
      setError(tr('welcome.invalidPhone'));
      return;
    }
    setError(undefined);
    start.mutate(phone, {
      onSuccess: (sent) => navigation.navigate('PhoneVerify', { phone: sent.phone, isNewUser: sent.isNewUser, devCode: sent.devCode }),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <LinearGradient
        colors={[t.colors.heroFrom, t.colors.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 380 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: t.spacing.gutter }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', marginTop: t.spacing['2xl'], marginBottom: t.spacing['2xl'] }}>
              <LogoMark size={72} />
              <Text variant="h1" tone="hero" align="center" style={{ marginTop: t.spacing.lg }}>
                {tr('welcome.tagline')}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: t.colors.surface,
                borderRadius: 24,
                padding: t.spacing.xl,
                borderWidth: t.isDark ? 1 : 0,
                borderColor: t.colors.border,
                ...(t.elevation(2) as object),
              }}
            >
              <Text variant="h2">{tr('welcome.getStarted')}</Text>
              <Text tone="secondary" style={{ marginTop: 4, marginBottom: t.spacing.xl }}>
                {tr('welcome.intro')}
              </Text>
              <PhoneInput
                country={country}
                onCountryChange={setCountry}
                value={digits}
                onChangeText={(d) => {
                  setDigits(d);
                  if (error) setError(undefined);
                }}
                error={error}
                onSubmitEditing={submit}
              />
              <Button title={tr('common.continue')} size="lg" fullWidth onPress={submit} loading={start.isPending} />
              <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: t.spacing.md }}>
                {tr('welcome.smsNote')}
              </Text>
              {!USE_MOCK_API ? (
                <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: 4 }}>
                  {tRich('welcome.agree', {
                    terms: (
                      <Text key="terms" variant="caption" weight="bold" tone="secondary" onPress={() => Linking.openURL(LEGAL_URLS.terms)} accessibilityRole="link">
                        {tr('plans.terms')}
                      </Text>
                    ),
                    privacy: (
                      <Text key="privacy" variant="caption" weight="bold" tone="secondary" onPress={() => Linking.openURL(LEGAL_URLS.privacy)} accessibilityRole="link">
                        {tr('legal.privacy')}
                      </Text>
                    ),
                  })}
                </Text>
              ) : null}
            </View>

            <View style={{ flex: 1, minHeight: t.spacing.xl }} />
            {/* Language switcher, before anyone has an account. */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginBottom: t.spacing.sm }}>
              {LANGUAGES.map((l) => (
                <Pressable key={l.code} onPress={() => setLanguage(l.code)} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: lang === l.code }}>
                  <Text variant="label" tone={lang === l.code ? 'primary' : 'tertiary'} weight={lang === l.code ? 'bold' : 'medium'}>
                    {l.native}
                  </Text>
                </Pressable>
              ))}
            </View>
            {USE_MOCK_API ? (
            <>
            <Button
              title={tr('welcome.demo')}
              variant="ghost"
              icon="auto-awesome"
              loading={demo.isPending}
              onPress={() => demo.mutate({ email: 'alex@example.com', password: 'password123' })}
              fullWidth
            />
            <Pressable
              onPress={() => navigation.navigate('Login')}
              hitSlop={8}
              accessibilityRole="link"
              style={{ alignSelf: 'center', paddingVertical: t.spacing.sm }}
            >
              <Text variant="label" tone="secondary">
                {tr('welcome.useEmail')}
              </Text>
            </Pressable>
            </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default WelcomeScreen;
