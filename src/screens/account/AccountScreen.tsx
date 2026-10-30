import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useCurrentUser, useDeleteAccount, useLogout, useUpdateProfile } from '../../hooks/useAuth';
import { formatPhone } from '../../utils/phone';
import { useEntitlements, useManageSubscription, useResetDemoPlan } from '../../hooks/useBilling';
import { useShowModal, useUIStore, ThemePreference } from '../../store/uiStore';
import { planName } from '../../billing/plans';
import { LANGUAGES, deviceLanguage, useLanguageStore, useT } from '../../i18n';
import { useMyCurrency, useSetMyCurrency } from '../../hooks/useCurrency';
import { currencyName } from '../../utils/currency';
import CurrencyPicker from '../../components/CurrencyPicker';
import { APP_VERSION } from '../../constants';
import { LEGAL_URLS, USE_MOCK_API } from '../../config';
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
  const { t: tr, lang } = useT();
  const user = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const setMyCurrency = useSetMyCurrency();
  const languagePref = useLanguageStore((s) => s.preference);
  const setLanguagePref = useLanguageStore((s) => s.setPreference);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
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

  const storeBilled = !!subscription?.provider && subscription.provider !== 'stripe';
  const storeName = subscription?.provider === 'app_store' ? tr('store.appStore') : tr('store.googlePlay');
  const currentPlan = planName(plan);
  const languageLabel = languagePref === 'system'
    ? tr('account.languageSystem', { language: LANGUAGES.find((l) => l.code === deviceLanguage())!.native })
    : LANGUAGES.find((l) => l.code === languagePref)!.native;
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
        <Button title={tr('account.editProfile')} icon="edit" variant="ghost" size="sm" onPress={() => setEditing(true)} style={{ marginTop: 6 }} />
      </View>

      {/* Plan */}
      <Card style={{ borderWidth: 1.5, borderColor: isPaid ? t.colors.pro : t.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isPaid ? t.colors.proSoft : t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={isPaid ? 'workspace-premium' : 'star-outline'} size={24} color={isPaid ? t.colors.pro : t.colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="overline" tone="tertiary">
              {tr('account.yourPlan')}
            </Text>
            <Text variant="h3">WhoOwes {currentPlan}</Text>
          </View>
          {subscription?.isDemo ? <Badge label={tr('account.demo')} tone="info" /> : null}
        </View>

        {subscription?.status === 'past_due' ? (
          <Text variant="caption" tone="negative" style={{ marginTop: 10 }}>
            {storeBilled
              ? tr('account.pastDueStore', { store: storeName, plan: currentPlan })
              : tr('account.pastDueCard', { plan: currentPlan })}
          </Text>
        ) : null}
        {isPaid && subscription?.currentPeriodEnd ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: 10 }}>
            {tr(subscription.cancelAtPeriodEnd ? 'account.ends' : subscription.status === 'trialing' ? 'account.trialEnds' : 'account.renews', {
              date: formatShortDate(subscription.currentPeriodEnd),
            })}
            {subscription.interval ? ` · ${tr(subscription.interval === 'year' ? 'account.billedYearly' : 'account.billedMonthly')}` : ''}
          </Text>
        ) : null}

        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text variant="caption" tone="secondary">
              {tr('account.scansThisMonth')}
            </Text>
            <Text variant="caption" weight="bold">
              {limit == null ? `${used} · ${tr('account.unlimited')}` : `${used} / ${limit}`}
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
          {plan !== 'pro' ? <Button title={isPaid ? tr('account.upgradePro') : tr('common.seePlans')} variant="pro" style={{ flex: 1 }} onPress={() => navigation.navigate('Plans')} /> : null}
          {isPaid ? (
            <Button
              title={
                subscription?.isDemo
                  ? tr(subscription.cancelAtPeriodEnd ? 'account.resume' : 'common.cancel')
                  : tr(storeBilled ? 'account.manageSubscription' : 'account.manageBilling')
              }
              variant="secondary"
              style={{ flex: 1 }}
              loading={manage.isPending}
              onPress={() => manage.mutate()}
            />
          ) : null}
        </View>
        {subscription?.isDemo && isPaid ? (
          <Button title={tr('account.resetDemo')} variant="ghost" size="sm" onPress={() => resetDemo.mutate()} style={{ marginTop: 6 }} />
        ) : null}
      </Card>

      <SectionHeader title={tr('account.preferences')} />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        <ListRow
          leading={<Icon name="translate" color={t.colors.primary} />}
          title={tr('account.language')}
          trailing={<Text tone="secondary">{languageLabel}</Text>}
          chevron
          divider
          onPress={() => setLanguageOpen(true)}
        />
        <ListRow
          leading={<Icon name="payments" color={t.colors.primary} />}
          title={tr('account.currency')}
          subtitle={currencyName(myCurrency, lang)}
          trailing={<Text tone="secondary">{myCurrency}</Text>}
          chevron
          onPress={() => setCurrencyOpen(true)}
        />
      </Card>
      <Text variant="caption" tone="tertiary" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {tr('account.currencyHint')}
      </Text>

      <SectionHeader title={tr('account.appearance')} />
      <SegmentedControl<ThemePreference>
        value={themePref}
        onChange={setThemePref}
        options={[
          { value: 'system', label: tr('account.themeSystem') },
          { value: 'light', label: tr('account.themeLight') },
          { value: 'dark', label: tr('account.themeDark') },
        ]}
      />

      <SectionHeader title={tr('account.money')} />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        <ListRow leading={<Icon name="insights" color={t.colors.primary} />} title={tr('account.insights')} chevron divider onPress={() => navigation.navigate('Insights')} />
        <ListRow leading={<Icon name="account-balance-wallet" color={t.colors.primary} />} title={tr('friend.payments')} chevron onPress={() => navigation.navigate('Settlements')} />
      </Card>

      <SectionHeader title={tr('account.about')} />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        <ListRow leading={<LogoMark size={28} />} title="WhoOwes" subtitle={tr('account.version', { version: APP_VERSION })} divider />
        <ListRow
          leading={<Icon name="phone-iphone" color={t.colors.textSecondary} />}
          title={tr('account.phone')}
          trailing={<Text tone="secondary">{user.phone ? formatPhone(user.phone) : tr('account.notSet')}</Text>}
          divider
        />
        <ListRow
          leading={<Icon name="event" color={t.colors.textSecondary} />}
          title={tr('account.memberSince')}
          trailing={<Text tone="secondary">{user.createdAt ? formatShortDate(user.createdAt) : '—'}</Text>}
          divider={!USE_MOCK_API}
        />
        {!USE_MOCK_API ? (
          <>
            <ListRow leading={<Icon name="privacy-tip" color={t.colors.textSecondary} />} title={tr('legal.privacy')} chevron divider onPress={() => Linking.openURL(LEGAL_URLS.privacy)} />
            <ListRow leading={<Icon name="description" color={t.colors.textSecondary} />} title={tr('legal.terms')} chevron onPress={() => Linking.openURL(LEGAL_URLS.terms)} />
          </>
        ) : null}
      </Card>

      <Button
        title={tr('account.signOut')}
        icon="logout"
        variant="danger"
        fullWidth
        style={{ marginTop: t.spacing.xl }}
        loading={logout.isPending}
        onPress={() =>
          showModal({
            title: tr('account.signOutTitle'),
            body: tr('account.signOutBody'),
            confirmLabel: tr('account.signOut'),
            variant: 'danger',
            onConfirm: () => logout.mutate(),
          })
        }
      />
      <Button
        title={tr('account.delete')}
        variant="ghost"
        fullWidth
        style={{ marginTop: t.spacing.sm }}
        loading={deleteAccount.isPending}
        onPress={() =>
          showModal({
            title: tr('account.deleteTitle'),
            body:
              (storeBilled && isPaid ? tr('account.deleteStoreFirst', { store: storeName }) + ' ' : '') +
              tr(storeBilled ? 'account.deleteBodyStore' : 'account.deleteBody'),
            confirmLabel: tr('account.delete'),
            variant: 'danger',
            onConfirm: () => deleteAccount.mutate(),
          })
        }
      />

      <BottomSheet visible={editing} onClose={() => setEditing(false)} title={tr('account.editProfile')}>
        <Input label={tr('account.name')} value={name} onChangeText={setName} autoCapitalize="words" />
        <Input
          label={tr('account.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
          hint={tr('account.emailHint')}
        />
        <Input label={tr('account.phone')} value={user.phone ? formatPhone(user.phone) : ''} editable={false} hint={tr('account.phoneHint')} />
        <Button
          title={tr('common.save')}
          size="lg"
          fullWidth
          disabled={!name.trim()}
          loading={update.isPending}
          onPress={() => update.mutate({ name: name.trim(), email: email.trim() }, { onSuccess: () => setEditing(false) })}
        />
      </BottomSheet>

      <BottomSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} title={tr('account.language')}>
        {(['system', ...LANGUAGES.map((l) => l.code)] as const).map((code) => (
          <ListRow
            key={code}
            title={code === 'system' ? tr('account.languageSystem', { language: LANGUAGES.find((l) => l.code === deviceLanguage())!.native }) : LANGUAGES.find((l) => l.code === code)!.native}
            onPress={() => {
              setLanguagePref(code);
              setLanguageOpen(false);
            }}
            trailing={languagePref === code ? <Icon name="check" color={t.colors.primary} /> : null}
          />
        ))}
      </BottomSheet>

      <CurrencyPicker
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        value={myCurrency}
        title={tr('account.currency')}
        onSelect={(c) => setMyCurrency.mutate(c)}
      />
    </Screen>
  );
};

export default AccountScreen;
