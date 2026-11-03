import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { View, type ScrollViewInstance } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import {
  useAddComment,
  useDeleteComment,
  useDeleteExpense,
  useExpense,
  useExpenseActivity,
  useMarkSplitPaid,
  useReactToExpense,
} from '../../hooks/useExpenses';
import { useGroups } from '../../hooks/useGroups';
import { useCurrentUser } from '../../hooks/useAuth';
import { useShowModal } from '../../store/uiStore';
import { formatCurrency } from '../../utils/currency';
import { formatFullDate } from '../../utils/date';
import { expenseForMe, firstName } from '../../utils/money';
import { categoryLabel } from '../../constants';
import { getSplitTypeLabel } from '../../utils/splitEngine';
import { useT } from '../../i18n';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import IconButton from '../../components/ui/IconButton';
import CategoryIcon from '../../components/ui/CategoryIcon';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ReactionBar from '../../components/expenses/ReactionBar';
import CommentList from '../../components/expenses/CommentList';
import CommentComposer from '../../components/expenses/CommentComposer';

const ExpenseDetailScreen: React.FC<RootScreenProps<'ExpenseDetail'>> = ({ route, navigation }) => {
  const { expenseId, focus } = route.params;
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const { data: expense, isLoading, isError } = useExpense(expenseId);
  const { data: groups = [] } = useGroups();
  const del = useDeleteExpense();
  const markPaid = useMarkSplitPaid();
  const showModal = useShowModal();
  const isFocused = useIsFocused();
  const activityQ = useExpenseActivity(expenseId, { live: isFocused && !!expense });
  const react = useReactToExpense(expenseId);
  const addComment = useAddComment(expenseId);
  const deleteComment = useDeleteComment(expenseId);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const activity = activityQ.data;
  const comments = activity?.comments ?? [];

  // Opened from a comment notification: go down to the conversation once it has loaded.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (focus !== 'comments' || !activity || !expense || scrolledFor.current === expenseId) return;
    scrolledFor.current = expenseId;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
    return () => clearTimeout(id);
  }, [focus, activity, expense, expenseId]);

  const sendComment = (text: string, restore: () => void) => {
    addComment.mutate(text, { onError: restore });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const canDelete = !!expense && (expense.createdBy === me.id || expense.paidBy === me.id);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        canDelete ? (
          <IconButton
            icon="delete-outline"
            variant="ghost"
            size={40}
            accessibilityLabel={tr('expenseDetail.delete')}
            onPress={() =>
              showModal({
                title: tr('expenseDetail.deleteTitle'),
                body: tr('expenseDetail.deleteBody'),
                confirmLabel: tr('common.delete'),
                variant: 'danger',
                onConfirm: () => del.mutate(expenseId, { onSuccess: () => navigation.goBack() }),
              })
            }
          />
        ) : null,
    });
  }, [navigation, canDelete, expenseId, del, showModal, tr]);

  if (isLoading) {
    return (
      <Screen>
        <SkeletonList rows={4} />
      </Screen>
    );
  }
  if (isError || !expense) {
    return (
      <Screen>
        <EmptyState emoji="🫥" title={tr('expenseDetail.notFound')} body={tr('expenseDetail.maybeDeleted')} actionLabel={tr('common.goBack')} onAction={() => navigation.goBack()} />
      </Screen>
    );
  }

  const mine = expense.splits.find((s) => s.userId === me.id);
  const position = expenseForMe(expense, me.id);
  const group = groups.find((g) => g.id === expense.groupId);
  const iPaid = expense.paidBy === me.id;

  return (
    <Screen scrollRef={scrollRef} footer={<CommentComposer onSend={sendComment} />}>
      <View style={{ alignItems: 'center', paddingVertical: t.spacing.base }}>
        <CategoryIcon category={expense.category} size={64} />
        <Text variant="h2" align="center" style={{ marginTop: 12 }}>
          {expense.title}
        </Text>
        <Text variant="display" tabular style={{ marginTop: 4 }}>
          {formatCurrency(expense.amount, expense.currency)}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
          {iPaid ? tr('expense.youPaid') : tr('expense.theyPaid', { name: expense.paidByUser.name })} · {formatFullDate(expense.date)}
        </Text>
        {position.amount > 0 ? (
          <Badge
            style={{ alignSelf: 'center', marginTop: 12 }}
            label={`${position.label} ${formatCurrency(position.amount, expense.currency)}`}
            tone={position.tone === 'positive' ? 'positive' : position.tone === 'negative' ? 'negative' : 'neutral'}
          />
        ) : null}
        <View style={{ marginTop: t.spacing.base, alignSelf: 'stretch' }}>
          <ReactionBar reactions={activity?.reactions ?? []} myId={me.id} onReact={(emoji) => react.mutate(emoji)} />
        </View>
      </View>

      {mine && !iPaid && !mine.paid ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title={tr('expenseDetail.paidBack')}
            icon="check"
            variant="secondary"
            style={{ flex: 1 }}
            loading={markPaid.isPending}
            onPress={() => markPaid.mutate({ expenseId, userId: me.id })}
          />
          <Button
            title={tr('expenseDetail.pay', { name: firstName(expense.paidByUser.name) })}
            icon="swap-horiz"
            style={{ flex: 1 }}
            onPress={() =>
              navigation.navigate('SettleUp', { userId: expense.paidBy, amount: mine.amount, currency: expense.currency, groupId: expense.groupId ?? undefined })
            }
          />
        </View>
      ) : null}

      <SectionHeader title={tr('expenseDetail.splitHow', { how: getSplitTypeLabel(expense.splitType).toLocaleLowerCase() })} />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        {expense.splits.map((s, i) => {
          const isPayer = s.userId === expense.paidBy;
          return (
            <ListRow
              key={s.userId}
              divider={i < expense.splits.length - 1}
              leading={<Avatar name={s.user.name} size="sm" />}
              title={s.userId === me.id ? tr('common.you') : s.user.name}
              subtitle={isPayer ? tr('expenseDetail.paidTheBill') : s.paid ? tr('expenseDetail.paidBackShort') : tr('balance.owes')}
              trailing={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyStrong" tabular tone={isPayer || s.paid ? 'tertiary' : 'default'}>
                    {formatCurrency(s.amount, expense.currency)}
                  </Text>
                  {s.percentage != null ? (
                    <Text variant="caption" tone="tertiary">
                      {s.percentage}%
                    </Text>
                  ) : null}
                </View>
              }
            />
          );
        })}
      </Card>

      {expense.items && expense.items.length > 0 ? (
        <>
          <SectionHeader title={tr('expenseDetail.items')} />
          <Card padding={4} style={{ paddingHorizontal: 12 }}>
            {expense.items.map((item, i) => (
              <ListRow
                key={item.id}
                divider={i < expense.items!.length - 1}
                title={item.name}
                subtitle={item.quantity > 1 ? `×${item.quantity}` : undefined}
                trailing={<Text tabular>{formatCurrency(item.price * item.quantity, expense.currency)}</Text>}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title={tr('expenseDetail.details')} />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        <ListRow title={tr('expenseDetail.category')} trailing={<Text tone="secondary">{categoryLabel(expense.category)}</Text>} divider />
        <ListRow title={tr('receipt.currency')} trailing={<Text tone="secondary">{expense.currency}</Text>} divider />
        <ListRow
          title={tr('expense.group')}
          trailing={<Text tone={group ? 'primary' : 'secondary'}>{group?.name ?? tr('expenseDetail.none')}</Text>}
          onPress={group ? () => navigation.navigate('GroupDetail', { groupId: group.id }) : undefined}
          divider={!!expense.description || !!expense.receiptId}
        />
        {expense.receiptId ? (
          <ListRow title={tr('expenseDetail.receipt')} trailing={<Badge label={tr('expenseDetail.scannedWithAI')} tone="primary" icon="auto-awesome" />} divider={!!expense.description} />
        ) : null}
        {expense.description ? <ListRow title={tr('expenseDetail.notes')} subtitle={expense.description} /> : null}
      </Card>

      <SectionHeader title={comments.length ? tr('comments.titleCount', { count: comments.length }) : tr('comments.title')} />
      <Card padding={4} style={{ paddingHorizontal: 12 }}>
        <CommentList
          comments={comments}
          myId={me.id}
          onDelete={(cm) =>
            showModal({
              title: tr('comments.deleteTitle'),
              body: tr('comments.deleteBody'),
              confirmLabel: tr('common.delete'),
              variant: 'danger',
              onConfirm: () => deleteComment.mutate(cm.id),
            })
          }
        />
      </Card>
      <Text variant="caption" tone="tertiary" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {tr('comments.notifyHint')}
      </Text>
    </Screen>
  );
};

export default ExpenseDetailScreen;
