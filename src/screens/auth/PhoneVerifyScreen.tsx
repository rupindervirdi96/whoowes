import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useStartPhoneSignIn, useVerifyPhoneCode } from '../../hooks/useAuth';
import { formatPhone } from '../../utils/phone';
import { useTheme } from '../../theme';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import IconButton from '../../components/ui/IconButton';
import Icon from '../../components/ui/Icon';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneVerify'>;

const CODE_LENGTH = 6;
const RESEND_AFTER = 30;

/** Step 2 of phone sign-in: type the texted code (and your name, if you're new). */
const PhoneVerifyScreen: React.FC<Props> = ({ navigation, route }) => {
  const t = useTheme();
  const { phone, isNewUser } = route.params;
  const [devCode, setDevCode] = useState(route.params.devCode);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const [wait, setWait] = useState(RESEND_AFTER);
  const codeRef = useRef<TextInputInstance>(null);
  const verify = useVerifyPhoneCode();
  const resend = useStartPhoneSignIn();

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const submit = (value = code) => {
    if (value.length < CODE_LENGTH) {
      setError('Enter the 6-digit code');
      return;
    }
    if (isNewUser && !name.trim()) {
      setNameError('Tell us your name');
      return;
    }
    setError(undefined);
    verify.mutate(
      { phone, code: value, name: isNewUser ? name.trim() : undefined },
      {
        onError: (e: { message?: string; code?: string }) => {
          if (e.code === 'name_required') setNameError(e.message);
          else setError(e.message ?? "That code didn't work. Try again.");
          setCode('');
          codeRef.current?.focus();
        },
      },
    );
  };

  const onCode = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(undefined);
    // Returning users go straight in once the code is complete.
    if (digits.length === CODE_LENGTH && !isNewUser) submit(digits);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: t.spacing.gutter }} keyboardShouldPersistTaps="handled">
          <IconButton icon="arrow-back" variant="ghost" accessibilityLabel="Back" onPress={() => navigation.goBack()} style={{ marginLeft: -10 }} />

          <Text variant="h1" style={{ marginTop: t.spacing.lg }}>
            {isNewUser ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text tone="secondary" style={{ marginTop: t.spacing.sm }}>
            Enter the code we texted to{' '}
            <Text weight="semibold" tone="default">
              {formatPhone(phone)}
            </Text>
            .{' '}
            <Text weight="semibold" tone="primary" onPress={() => navigation.goBack()} accessibilityRole="link">
              Change
            </Text>
          </Text>

          {/* One hidden input drives six boxes, so paste and SMS autofill just work. */}
          <Pressable onPress={() => codeRef.current?.focus()} style={{ marginTop: t.spacing['2xl'] }} accessibilityLabel="Verification code">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const active = i === code.length;
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 58,
                      borderRadius: 14,
                      borderWidth: active ? 2 : 1,
                      borderColor: error ? t.colors.negative : active ? t.colors.primary : t.colors.border,
                      backgroundColor: t.colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text variant="h2" tabular>
                      {code[i] ?? ''}
                    </Text>
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={codeRef}
              value={code}
              onChangeText={onCode}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={CODE_LENGTH}
              autoFocus
              caretHidden
              style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }}
            />
          </Pressable>
          {error ? (
            <Text variant="caption" tone="negative" style={{ marginTop: t.spacing.sm }}>
              {error}
            </Text>
          ) : null}

          {devCode ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginTop: t.spacing.base,
                padding: 14,
                borderRadius: 16,
                backgroundColor: t.colors.surfaceAlt,
              }}
            >
              <Icon name="info-outline" size={18} color={t.colors.textSecondary} />
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                Test mode: no text is sent. Your code is {devCode}.
              </Text>
              <Text variant="label" tone="primary" onPress={() => onCode(devCode)} accessibilityRole="button">
                Fill in
              </Text>
            </View>
          ) : null}

          {isNewUser ? (
            <Input
              label="Your name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError(undefined);
              }}
              placeholder="First and last name"
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              error={nameError}
              containerStyle={{ marginTop: t.spacing.xl }}
              onSubmitEditing={() => submit()}
            />
          ) : null}

          <View style={{ flex: 1, minHeight: t.spacing.xl }} />
          <Button
            title={isNewUser ? 'Create account' : 'Continue'}
            size="lg"
            fullWidth
            loading={verify.isPending}
            onPress={() => submit()}
          />
          <Button
            title={wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
            variant="ghost"
            disabled={wait > 0}
            loading={resend.isPending}
            onPress={() =>
              resend.mutate(phone, {
                onSuccess: (sent) => {
                  setWait(RESEND_AFTER);
                  setDevCode(sent.devCode);
                },
              })
            }
            style={{ marginTop: 6 }}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PhoneVerifyScreen;
