import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import Text from './Text';
import Button from './Button';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

const EmptyState: React.FC<EmptyStateProps> = ({ emoji = '🦉', title, body, actionLabel, onAction, style }) => {
  const t = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingVertical: t.spacing['2xl'], paddingHorizontal: t.spacing.xl }, style]}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: t.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.base,
        }}
      >
        <Text style={{ fontSize: 34, lineHeight: 40 }}>{emoji}</Text>
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="secondary" align="center" style={{ marginTop: 6, maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} size="sm" style={{ marginTop: t.spacing.base }} />
      ) : null}
    </View>
  );
};

export default EmptyState;
