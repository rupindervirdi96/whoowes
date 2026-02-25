/**
 * Login Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useLogin } from '../../hooks/useAuth';
import { loginSchema, LoginFormValues } from '../../utils/validation';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { MaterialIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<LoginFormValues>>({});
  const { mutate: login, isPending } = useLogin();

  const handleChange = (field: keyof LoginFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = () => {
    const result = loginSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<LoginFormValues> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof LoginFormValues;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    login(result.data);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Brand */}
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="account-balance-wallet" size={40} color={Colors.white} />
          </View>
          <Text style={styles.appName}>WhoOwes</Text>
          <Text style={styles.tagline}>Smart expense splitting</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Sign in to your account</Text>

          <Input
            label="Email"
            value={values.email}
            onChangeText={(v) => handleChange('email', v)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            required
            leftIcon={<MaterialIcons name="email" size={18} color={Colors.gray400} />}
          />

          <Input
            label="Password"
            value={values.password}
            onChangeText={(v) => handleChange('password', v)}
            placeholder="••••••••"
            secureTextEntry
            error={errors.password}
            required
            leftIcon={<MaterialIcons name="lock" size={18} color={Colors.gray400} />}
          />

          {/* Quick fill demo hint */}
          <TouchableOpacity
            style={styles.demoHint}
            onPress={() =>
              setValues({ email: 'alex@example.com', password: 'password123' })
            }
          >
            <MaterialIcons name="auto-fix-high" size={14} color={Colors.primary} />
            <Text style={styles.demoText}>Fill with demo credentials</Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleSubmit}
            loading={isPending}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </View>

        {/* Register CTA */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}> Create one</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.base,
    paddingBottom: Spacing['4xl'],
  },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heading: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subheading: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  demoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.base,
    alignSelf: 'flex-end',
  },
  demoText: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontWeight: Typography.medium,
  },
  submitBtn: { marginTop: Spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  link: {
    fontSize: Typography.base,
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },
});

export default LoginScreen;
