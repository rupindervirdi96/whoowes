/**
 * Profile Screen â€” user info, settings, logout
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import type { MainTabParamList } from '../../types/navigation';
import { useCurrentUser, useUpdateProfile, useLogout } from '../../hooks/useAuth';
import { useUIStore, useIsDarkMode } from '../../store/uiStore';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<MainTabParamList, 'Profile'>;

const ProfileScreen: React.FC<Props> = () => {
  const currentUser = useCurrentUser();
  const { mutate: updateProfile, isPending: updating } = useUpdateProfile();
  const { mutate: logout, isPending: loggingOut } = useLogout();
  const isDarkMode = useIsDarkMode();
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setPhone(currentUser.phone ?? '');
    }
  }, [currentUser]);

  const hasChanges =
    name.trim() !== (currentUser?.name ?? '') ||
    phone.trim() !== (currentUser?.phone ?? '');

  const handleSave = () => {
    if (!name.trim()) return;
    updateProfile(
      {
        name: name.trim(),
        phone: phone.trim() || undefined,
      },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  const handleCancelEdit = () => {
    setName(currentUser?.name ?? '');
    setPhone(currentUser?.phone ?? '');
    setEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  };

  const initials = (currentUser?.name ?? 'U')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen>
        <View style={styles.container}>
          {/* Avatar + Name Hero */}
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            {!editing ? (
              <>
                <Text style={styles.heroName}>{currentUser?.name}</Text>
                <Text style={styles.heroEmail}>{currentUser?.email}</Text>
                <TouchableOpacity
                  style={styles.editBadge}
                  onPress={() => setEditing(true)}
                >
                  <MaterialIcons name="edit" size={14} color={Colors.primary} />
                  <Text style={styles.editBadgeText}>Edit Profile</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          {/* Edit Form */}
          {editing && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Edit Profile</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={styles.inputDisabledText}>{currentUser?.email}</Text>
                </View>
                <Text style={styles.fieldHint}>Email cannot be changed</Text>
              </View>

              <View style={styles.editActions}>
                <Button
                  title="Cancel"
                  onPress={handleCancelEdit}
                  variant="outline"
                  style={styles.editActionBtn}
                />
                <Button
                  title={updating ? 'Saving...' : 'Save Changes'}
                  onPress={handleSave}
                  loading={updating}
                  disabled={!hasChanges || !name.trim()}
                  style={styles.editActionBtn}
                />
              </View>
            </View>
          )}

          {/* Account Info (read-only when not editing) */}
          {!editing && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Account</Text>
              <InfoRow icon="email" label="Email" value={currentUser?.email ?? ''} />
              <InfoRow
                icon="phone"
                label="Phone"
                value={currentUser?.phone ?? 'Not set'}
                muted={!currentUser?.phone}
              />
              <InfoRow
                icon="calendar-today"
                label="Member since"
                value={formatDate(currentUser?.createdAt ?? '')}
              />
            </View>
          )}

          {/* Preferences */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Preferences</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="dark-mode" size={20} color={Colors.textSecondary} />
                <Text style={styles.settingLabel}>Dark Mode</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: Colors.gray200, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* App Info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About</Text>
            <InfoRow icon="info-outline" label="Version" value="1.0.0" />
            <InfoRow icon="code" label="Built with" value="Expo + React Native" />
          </View>

          {/* Logout */}
          <View style={styles.logoutSection}>
            <Button
              title={loggingOut ? 'Logging out...' : 'Log Out'}
              onPress={handleLogout}
              variant="outline"
              fullWidth
              loading={loggingOut}
              style={styles.logoutBtn}
              leftIcon={
                !loggingOut ? (
                  <MaterialIcons name="logout" size={18} color={Colors.danger} />
                ) : undefined
              }
            />
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
};

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const InfoRow: React.FC<{
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  muted?: boolean;
}> = ({ icon, label, value, muted }) => (
  <View style={infoStyles.row}>
    <MaterialIcons name={icon} size={18} color={Colors.textSecondary} style={infoStyles.icon} />
    <Text style={infoStyles.label}>{label}</Text>
    <Text style={[infoStyles.value, muted && infoStyles.valueMuted]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  container: {
    padding: Spacing.base,
    gap: Spacing.base,
    paddingBottom: Spacing.xl * 2,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.base,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    ...Shadows.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: Typography.bold,
    color: Colors.white,
    letterSpacing: 1,
  },
  heroName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  heroEmail: { fontSize: Typography.sm, color: Colors.textSecondary },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '15',
    marginTop: Spacing.xs,
  },
  editBadgeText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.medium },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  field: { gap: 4 },
  fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.base,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  inputDisabled: {
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
  },
  inputDisabledText: { fontSize: Typography.base, color: Colors.textTertiary },
  fieldHint: { fontSize: 10, color: Colors.textTertiary },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  editActionBtn: { flex: 1 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingLabel: { fontSize: Typography.base, color: Colors.textPrimary },
  logoutSection: { marginTop: Spacing.sm },
  logoutBtn: { borderColor: Colors.danger },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  icon: { width: 20 },
  label: { width: 100, fontSize: Typography.sm, color: Colors.textSecondary },
  value: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },
  valueMuted: { color: Colors.textTertiary, fontWeight: '400' },
});

export default ProfileScreen;


