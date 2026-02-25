/**
 * Add Expense Screen — choose between manual entry or receipt upload
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { ExpensesStackParamList } from '../../types/navigation';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'AddExpense'>;

interface OptionCardProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  badge?: string;
  onPress: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({
  icon,
  iconColor,
  title,
  description,
  badge,
  onPress,
}) => (
  <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.optionIcon, { backgroundColor: iconColor + '20' }]}>
      <MaterialIcons name={icon} size={28} color={iconColor} />
    </View>
    <View style={styles.optionContent}>
      <View style={styles.optionTitleRow}>
        <Text style={styles.optionTitle}>{title}</Text>
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.optionDesc}>{description}</Text>
    </View>
    <MaterialIcons name="chevron-right" size={22} color={Colors.gray300} />
  </TouchableOpacity>
);

const AddExpenseScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <Screen scrollable={false}>
      <View style={styles.container}>
        <Text style={styles.heading}>How do you want to add this expense?</Text>

        <OptionCard
          icon="edit"
          iconColor={Colors.primary}
          title="Enter Manually"
          description="Type in the amount, category, and split details yourself"
          onPress={() => navigation.navigate('ManualExpense', {})}
        />

        <OptionCard
          icon="camera-alt"
          iconColor={Colors.success}
          title="Scan Receipt"
          description="Take a photo or upload from gallery — AI will parse the items"
          badge="AI"
          onPress={() => navigation.navigate('ReceiptUpload', {})}
        />

        <OptionCard
          icon="picture-as-pdf"
          iconColor={Colors.danger}
          title="Upload PDF / File"
          description="Import a PDF receipt or document for AI to analyze"
          badge="AI"
          onPress={() => navigation.navigate('ReceiptUpload', { fileType: 'pdf' })}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.base,
  },
  heading: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.base,
    ...Shadows.base,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: { flex: 1 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  optionTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  optionDesc: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 9, fontWeight: Typography.bold, color: Colors.white, letterSpacing: 0.5 },
});

export default AddExpenseScreen;
