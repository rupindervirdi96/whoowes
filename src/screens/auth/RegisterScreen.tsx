import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useRegister } from '../../hooks/useAuth';
import { registerSchema, RegisterFormValues } from '../../utils/validation';
import { useTheme } from '../../theme';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import IconButton from '../../components/ui/IconButton';
import { LogoMark } from '../../components/ui/Logo';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Errors = Partial<Record<keyof RegisterFormValues, string>>;

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const t = useTheme();
  const [values, setValues] = useState<RegisterFormValues>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const { mutate: register, isPending } = useRegister();

  const set = (field: keyof RegisterFormValues, v: string) => {
    setValues((p) => ({ ...p, [field]: v }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const submit = () => {
    const result = registerSchema.safeParse(values);
    if (!result.success) {
      const next: Errors = {};
      result.error.issues.forEach((i) => {
        next[i.path[0] as keyof RegisterFormValues] ??= i.message;
      });
      setErrors(next);
      return;
    }
    const { confirmPassword: _ignored, ...payload } = result.data;
    register(payload);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg }} keyboardShouldPersistTaps="handled">
          <IconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
          <View style={{ marginTop: t.spacing.lg, marginBottom: t.spacing.xl }}>
            <LogoMark size={48} />
            <Text variant="h1" style={{ marginTop: t.spacing.base }}>
              Create your account
            </Text>
            <Text tone="secondary" style={{ marginTop: 6 }}>
              Free forever for splitting with friends.
            </Text>
          </View>

          <Input label="Full name" icon="person-outline" value={values.name} onChangeText={(v) => set('name', v)} placeholder="Alex Johnson" autoCapitalize="words" autoComplete="name" error={errors.name} />
          <Input label="Email" icon="alternate-email" value={values.email} onChangeText={(v) => set('email', v)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
          <Input label="Phone (optional)" icon="phone-iphone" value={values.phone} onChangeText={(v) => set('phone', v)} placeholder="+1 555 000 0000" keyboardType="phone-pad" autoComplete="tel" error={errors.phone} hint="Lets friends find you by number" />
          <Input label="Password" icon="lock-outline" value={values.password} onChangeText={(v) => set('password', v)} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" error={errors.password} hint="Use a capital letter and a number" />
          <Input label="Confirm password" icon="lock-outline" value={values.confirmPassword} onChangeText={(v) => set('confirmPassword', v)} placeholder="Type it again" secureTextEntry autoComplete="new-password" error={errors.confirmPassword} onSubmitEditing={submit} />

          <Button title="Create account" size="lg" onPress={submit} loading={isPending} fullWidth style={{ marginTop: 4 }} />
          <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: t.spacing.base }}>
            By continuing you agree to the Terms of Service and Privacy Policy.
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: t.spacing.xl }}>
            <Text tone="secondary">Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} accessibilityRole="link">
              <Text weight="bold" tone="primary">
                Sign in
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterScreen;
