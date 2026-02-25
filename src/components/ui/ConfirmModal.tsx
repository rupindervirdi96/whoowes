/**
 * Confirm Modal component.
 * Controlled by UIStore — call showModal() from anywhere in the app.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useModal, useHideModal } from '../../store/uiStore';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Button from './Button';

const ConfirmModal: React.FC = () => {
  const modal = useModal();
  const hideModal = useHideModal();

  const handleConfirm = () => {
    modal.onConfirm?.();
    hideModal();
  };

  const handleCancel = () => {
    modal.onCancel?.();
    hideModal();
  };

  return (
    <Modal
      visible={modal.visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable style={styles.sheet}>
          {modal.title && (
            <Text style={styles.title}>{modal.title}</Text>
          )}
          {modal.body && (
            <Text style={styles.body}>{modal.body}</Text>
          )}
          <View style={styles.actions}>
            <Button
              title={modal.cancelLabel ?? 'Cancel'}
              variant="ghost"
              onPress={handleCancel}
              style={styles.btn}
            />
            <Button
              title={modal.confirmLabel ?? 'Confirm'}
              variant={modal.variant === 'danger' ? 'danger' : 'primary'}
              onPress={handleConfirm}
              style={styles.btn}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 380,
    ...Shadows.lg,
  } as object,
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
  },
});

export default ConfirmModal;
