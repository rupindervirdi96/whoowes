/**
 * Register Screen
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useRegister } from '../../hooks/useAuth';
import { registerSchema, RegisterFormValues } from '../../utils/validation';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { MaterialIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type FormValues = RegisterFormValues;

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [values, setValues] = useState<FormValues>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const { mutate: register, isPending } = useRegister();

  const handleChange = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = () => {
    const result = registerSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormValues, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormValues;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    const { confirmPassword: _, ...payload } = result.data;
    register(payload);
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="account-balance-wallet" size={32} color={Colors.white} />
          </View>
          <Text style={styles.heading}>Create account</Text>
          <Text style={styles.subheading}>Join WhoOwes for free</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Input
            label="Full Name"
            value={values.name}
            onChangeText={(v) => handleChange('name', v)}
            placeholder="Alex Johnson"
            autoCapitalize="words"
            autoCorrect={false}
            error={errors.name}
            required
            leftIcon={<MaterialIcons name="person" size={18} color={Colors.gray400} />}
          />

          <Input
            label="Email Address"
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
            label="Phone Number (optional)"
            value={values.phone}
            onChangeText={(v) => handleChange('phone', v)}
            placeholder="+1 555 000 0000"
            keyboardType="phone-pad"
            error={errors.phone}
            leftIcon={<MaterialIcons name="phone" size={18} color={Colors.gray400} />}
          />

          <Input
            label="Password"
            value={values.password}
            onChangeText={(v) => handleChange('password', v)}
            placeholder="Min. 8 characters"
            secureTextEntry
            error={errors.password}
            helperText="Must contain uppercase letter and number"
            required
            leftIcon={<MaterialIcons name="lock" size={18} color={Colors.gray400} />}
          />

          <Input
            label="Confirm Password"
            value={values.confirmPassword}
            onChangeText={(v) => handleChange('confirmPassword', v)}
            placeholder="Repeat your password"
            secureTextEntry
            error={errors.confirmPassword}
            required
            leftIcon={<MaterialIcons name="lock-outline" size={18} color={Colors.gray400} />}
          />

          <Button
            title="Create Account"
            onPress={handleSubmit}
            loading={isPending}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </View>

        {/* Terms */}
        <Text style={styles.termsText}>
          By creating an account, you agree to our{' '}
          <Text style={styles.link}>Terms of Service</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>.
        </Text>

        {/* Login CTA */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}> Sign in</Text>
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
    padding: Spacing.base,
    paddingBottom: Spacing['4xl'],
    paddingTop: Spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
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
  submitBtn: { marginTop: Spacing.sm },
  termsText: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.sm,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.base,
  },
  footerText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  link: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },
});

export default RegisterScreen;
