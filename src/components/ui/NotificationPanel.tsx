/**
 * NotificationPanel — slides down from the top of the screen.
 * Usage: controlled by `visible` prop + `onClose` callback.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import { formatSmartDate } from '../../utils/date';
import type { Settlement } from '../../types';

// ─── Notification item types ──────────────────────────────────────────────────

export type NotificationItem =
  | { kind: 'pending_settlement'; settlement: Settlement; currentUserId: string }
  | { kind: 'info'; title: string; body: string; icon: keyof typeof MaterialIcons.glyphMap };

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotificationPanelProps {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onPressSettlement?: (settlementId: string) => void;
}

// ─── Panel height cap (max visible area before scroll) ───────────────────────
const PANEL_MAX_HEIGHT = 420;

// ─── Component ───────────────────────────────────────────────────────────────

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  visible,
  onClose,
  notifications,
  onPressSettlement,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-PANEL_MAX_HEIGHT - 60)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
          mass: 0.9,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -PANEL_MAX_HEIGHT - 60,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const handleItemPress = useCallback(
    (item: NotificationItem) => {
      onClose();
      if (item.kind === 'pending_settlement' && onPressSettlement) {
        onPressSettlement(item.settlement.id);
      }
    },
    [onClose, onPressSettlement],
  );

  // Don't render at all when fully off-screen and not visible
  // (keeps the tree clean, but keep it mounted so the close animation plays)

  return (
    <>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
      </TouchableWithoutFeedback>

      {/* Sliding panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            top: insets.top,
            transform: [{ translateY }],
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {/* Header */}
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderLeft}>
            <MaterialIcons name="notifications" size={20} color={Colors.primary} />
            <Text style={styles.panelTitle}>Notifications</Text>
          </View>
          <View style={styles.panelHeaderRight}>
            {notifications.length > 0 && (
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>{notifications.length}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Content */}
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="notifications-none" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyBody}>No new notifications at the moment.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {notifications.map((item, idx) => (
              <NotificationRow
                key={idx}
                item={item}
                isLast={idx === notifications.length - 1}
                onPress={() => handleItemPress(item)}
              />
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </>
  );
};

// ─── Single notification row ──────────────────────────────────────────────────

interface RowProps {
  item: NotificationItem;
  isLast: boolean;
  onPress: () => void;
}

const NotificationRow: React.FC<RowProps> = ({ item, isLast, onPress }) => {
  if (item.kind === 'pending_settlement') {
    const { settlement, currentUserId } = item;
    const isIncoming = settlement.toUserId === currentUserId;   // someone pays ME
    const otherUser = isIncoming ? settlement.fromUser : settlement.toUser;
    const subtitle = isIncoming
      ? `${otherUser.name} sent you a settlement request`
      : `Your settlement request to ${otherUser.name} is pending`;
    const iconColor = isIncoming ? Colors.success : Colors.warning;
    const iconBg = isIncoming ? Colors.success + '18' : Colors.warning + '18';

    return (
      <TouchableOpacity
        style={[styles.row, !isLast && styles.rowBorder]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <MaterialIcons name="swap-horiz" size={18} color={iconColor} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {formatCurrency(settlement.amount)} settlement
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
          <Text style={styles.rowDate}>{formatSmartDate(settlement.createdAt)}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  // Generic info notification
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.rowIcon, { backgroundColor: Colors.info + '18' }]}>
        <MaterialIcons name={item.icon} size={18} color={Colors.info} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowSubtitle}>{item.body}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 20, 40, 0.35)',
    zIndex: 99,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#F4FEFC',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    maxHeight: PANEL_MAX_HEIGHT,
    ...Shadows.lg,
    // Subtle top border to separate from status bar
    borderTopWidth: 1,
    borderTopColor: 'rgba(45, 165, 142, 0.12)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  panelTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  totalBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.white,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
  },
  list: {
    maxHeight: PANEL_MAX_HEIGHT - 70,
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  emptyBody: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  rowDate: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});

export default NotificationPanel;
