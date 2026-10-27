import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useCurrentUser, useDeleteAccount, useLogout, useUpdateProfile } from '../../hooks/useAuth';
import { formatPhone } from '../../utils/phone';
import { useEntitlements, useManageSubscription, useResetDemoPlan } from '../../hooks/useBilling';
import { useShowModal, useUIStore, ThemePreference } from '../../store/uiStore';
import { PLANS } from '../../billing/plans';
import { APP_VERSION } from '../../constants';
import { formatShortDate } from '../../utils/date';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import Input from '../../components/ui/Input';
import BottomSheet from '../../components/ui/BottomSheet';
import { SegmentedControl } from '../../components/ui/Chip';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import { LogoMark } from '../../components/ui/Logo';

const AccountScreen: React.FC<RootScreenProps<'Account'>> = ({ navigation }) => {
  const t = useTheme();
  const user = useCurrentUser()!;
  const logout = useLogout();
  const update = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const showModal = useShowModal();
  const themePref = useUIStore((s) => s.themePreference);
  const setThemePref = useUIStore((s) => s.setThemePreference);
  const { plan, subscription, isPaid } = useEntitlements();
  const manage = useManageSubscription();
  const resetDemo = useResetDemoPlan();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? '');

  const used = subscription?.scansUsed ?? 0;
  const limit = subscription?.scansLimit;

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingVertical: t.spacing.base }}>
        <Avatar name={user.name} uri={user.avatarUrl} size="xl" />
        <Text variant="h2" style={{ marginTop: 12 }}>
          {user.name}
        </Text>
        <Text tone="tertiary">{user.phone ? formatPhone(user.phone) : user.email}</Text>
        <Button title="Edit profile" icon="edit" variant="ghost" size="sm" onPress={() => setEditing(true)} style={{ marginTop: 6 }} />
      </View>

      {/* Plan */}
      <Card style={{ borderWidth: 1.5, borderColor: isPaid ? t.colors.pro : t.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isPaid ? t.colors.proSoft : t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={isPaid ? 'workspace-premium' : 'star-outline'} size={24} color={isPaid ? t.colors.pro : t.colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="overline" tone="tertiary">
              Your plan
            </Text>
            <Text variant="h3">WhoOwes {PLANS[plan].name}</Text>
          </View>
          {subscription?.isDemo ? <Badge label="Demo" tone="info" /> : null}
        </View>

        {subscription?.status === 'past_due' ? (
          <Text variant="caption" tone="negative" style={{ marginTop: 10 }}>
            Your last payment failed — update your card to keep {PLANS[plan].name}.
          </Text>
        ) : null}
        {isPaid && subscription?.currentPeriodEnd ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: 10 }}>
            {subscription.cancelAtPeriodEnd ? 'Ends' : subscription.status === 'trialing' ? 'Trial ends' : 'Renews'} {formatShortDate(subscription.currentPeriodEnd)}
            {subscription.interval ? ` · billed ${subscription.interval === 'year' ? 'yearly' : 'monthly'}` : ''}
          </Text>
        ) : null}

        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text variant="caption" tone="secondary">
              AI receipt scans this month
            </Text>
            <Text variant="caption" weight="bold">
              {limit == null ? `${used} · unlimited` : `${used} / ${limit}`}
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }}>
            <View
              style={{
                height: 6,
                width: limit == null ? '100%' : `${Math.min(100, (used / Math.max(limit, 1)) * 100)}%`,
                backgroundColor: limit != null && used >= limit ? t.colors.negative : t.colors.primary,
                opacity: limit == null ? 0.35 : 1,
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.base }}>
          {plan !== 'pro' ? <Button title={isPaid ? 'Upgrade to Pro' : 'See plans'} variant="pro" style={{ flex: 1 }} onPress={() => navigation.navigate('Plans')} /> : null}
          {isPaid ? (
            <Button
              title={subscription?.isDemo ? (subscription.cancelAtPeriodEnd ? 'Resume' : 'Cancel') : 'Manage billing'}
              variant="secondary"
              style={{ flex: 1 }}
              loading={manage.isPending}
              onPress={() => manage.mutate()}
            />
          ) : null}
        </View>
        {subscription?.isDemo && isPaid ? (
          <Button title="Reset demo to Free" variant="ghost" size="sm" onPress={() => resetDemo.mutate()} style={{ marginTop: 6 }} />
        ) : null}
      </Card>

      <SectionHeader title="Appearance" />
      <SegmentedControl<ThemePreference>
        value={themePref}
        onChange={setThemePref}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />

      <SectionHeader title="Money" />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        <ListRow leading={<Icon name="insights" color={t.colors.primary} />} title="Spending insights" chevron divider onPress={() => navigation.navigate('Insights')} />
        <ListRow leading={<Icon name="account-balance-wallet" color={t.colors.primary} />} title="Payments" chevron onPress={() => navigation.navigate('Settlements')} />
      </Card>

      <SectionHeader title="About" />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        <ListRow leading={<LogoMark size={28} />} title="WhoOwes" subtitle={`Version ${APP_VERSION}`} divider />
        <ListRow leading={<Icon name="phone-iphone" color={t.colors.textSecondary} />} title="Phone" trailing={<Text tone="secondary">{user.phone ? formatPhone(user.phone) : 'Not set'}</Text>} divider />
        <ListRow leading={<Icon name="event" color={t.colors.textSecondary} />} title="Member since" trailing={<Text tone="secondary">{user.createdAt ? formatShortDate(user.createdAt) : '—'}</Text>} />
      </Card>

      <Button
        title="Sign out"
        icon="logout"
        variant="danger"
        fullWidth
        style={{ marginTop: t.spacing.xl }}
        loading={logout.isPending}
        onPress={() =>
          showModal({
            title: 'Sign out?',
            body: 'You can sign back in any time.',
            confirmLabel: 'Sign out',
            variant: 'danger',
            onConfirm: () => logout.mutate(),
          })
        }
      />
      <Button
        title="Delete account"
        variant="ghost"
        fullWidth
        style={{ marginTop: t.spacing.sm }}
        loading={deleteAccount.isPending}
        onPress={() =>
          showModal({
            title: 'Delete your account?',
            body: 'Your profile, friends and phone number are removed and any subscription is cancelled. Expenses you shared stay in other people’s history as “Deleted user”. This can’t be undone.',
            confirmLabel: 'Delete account',
            variant: 'danger',
            onConfirm: () => deleteAccount.mutate(),
          })
        }
      />

      <BottomSheet visible={editing} onClose={() => setEditing(false)} title="Edit profile">
        <Input label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" hint="Used for receipts and billing emails" />
        <Input label="Phone" value={user.phone ? formatPhone(user.phone) : ''} editable={false} hint="Your phone number is how you sign in" />
        <Button
          title="Save"
          size="lg"
          fullWidth
          disabled={!name.trim()}
          loading={update.isPending}
          onPress={() => update.mutate({ name: name.trim(), email: email.trim() }, { onSuccess: () => setEditing(false) })}
        />
      </BottomSheet>
    </Screen>
  );
};

export default AccountScreen;
