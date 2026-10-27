import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useLogin } from '../../hooks/useAuth';
import { loginSchema, LoginFormValues } from '../../utils/validation';
import { useTheme } from '../../theme';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { LogoMark } from '../../components/ui/Logo';
import IconButton from '../../components/ui/IconButton';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const t = useTheme();
  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<LoginFormValues>>({});
  const { mutate: login, isPending } = useLogin();

  const set = (field: keyof LoginFormValues, v: string) => {
    setValues((p) => ({ ...p, [field]: v }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const submit = (v = values) => {
    const result = loginSchema.safeParse(v);
    if (!result.success) {
      const next: Partial<LoginFormValues> = {};
      result.error.issues.forEach((i) => {
        next[i.path[0] as keyof LoginFormValues] ??= i.message;
      });
      setErrors(next);
      return;
    }
    login(result.data);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <LinearGradient
        colors={[t.colors.heroFrom, t.colors.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 360 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: t.spacing.gutter }} keyboardShouldPersistTaps="handled">
            {navigation.canGoBack() ? (
              <IconButton icon="arrow-back" variant="hero" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
            ) : null}
            <View style={{ alignItems: 'center', marginTop: t.spacing.sm, marginBottom: t.spacing['2xl'] }}>
              <LogoMark size={76} />
              <Text variant="h1" tone="hero" align="center" style={{ marginTop: t.spacing.base }}>
                Split it. Settle it.{'\n'}Stay friends.
              </Text>
              <Text tone="heroMuted" align="center" style={{ marginTop: 8 }}>
                Who owes who — sorted in seconds.
              </Text>
            </View>

            <View
              style={{
                backgroundColor: t.colors.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
                borderWidth: t.isDark ? 1 : 0,
                borderColor: t.colors.border,
                ...(t.elevation(3) as object),
              }}
            >
              <Text variant="h2">Sign in with email</Text>
              <Text tone="secondary" style={{ marginTop: 4, marginBottom: t.spacing.lg }}>
                Prefer your phone number? Go back and use that instead.
              </Text>
              <Input
                label="Email"
                icon="alternate-email"
                value={values.email}
                onChangeText={(v) => set('email', v)}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email}
              />
              <Input
                label="Password"
                icon="lock-outline"
                value={values.password}
                onChangeText={(v) => set('password', v)}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="password"
                error={errors.password}
                onSubmitEditing={() => submit()}
              />
              <Button title="Sign in" size="lg" onPress={() => submit()} loading={isPending} fullWidth />
              <Button
                title="Try the demo account"
                variant="ghost"
                icon="auto-awesome"
                onPress={() => {
                  const demo = { email: 'alex@example.com', password: 'password123' };
                  setValues(demo);
                  submit(demo);
                }}
                style={{ marginTop: 6 }}
                fullWidth
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: t.spacing.xl }}>
              <Text tone="secondary">New to WhoOwes? </Text>
              <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8} accessibilityRole="link">
                <Text weight="bold" tone="primary">
                  Create an account
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default LoginScreen;
