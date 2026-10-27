import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useHideModal, useModal } from '../../store/uiStore';
import { useTheme } from '../../theme';
import Text from './Text';
import Button from './Button';

/** Global confirm dialog — open it from anywhere with useShowModal(). */
const ConfirmModal: React.FC = () => {
  const t = useTheme();
  const modal = useModal();
  const hideModal = useHideModal();

  const cancel = () => {
    modal.onCancel?.();
    hideModal();
  };
  const confirm = () => {
    hideModal();
    modal.onConfirm?.();
  };

  return (
    <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={cancel} statusBarTranslucent>
      <Pressable
        onPress={cancel}
        style={{ flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'center', padding: 24 }}
      >
        <Pressable
          style={{
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.xl,
            padding: 24,
            ...(t.elevation(3) as object),
          }}
        >
          {modal.title ? <Text variant="h2">{modal.title}</Text> : null}
          {modal.body ? (
            <Text tone="secondary" style={{ marginTop: 8 }}>
              {modal.body}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
            <Button title={modal.cancelLabel ?? 'Cancel'} variant="secondary" onPress={cancel} style={{ flex: 1 }} />
            <Button
              title={modal.confirmLabel ?? 'Confirm'}
              variant={modal.variant === 'danger' ? 'danger' : 'primary'}
              onPress={confirm}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default ConfirmModal;
