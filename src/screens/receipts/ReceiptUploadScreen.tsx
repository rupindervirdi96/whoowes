/**
 * Receipt Upload Screen — camera, gallery, or PDF upload
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { ExpensesStackParamList } from '../../types/navigation';
import { useParseReceipt } from '../../hooks/useReceipts';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ReceiptUpload'>;

const ReceiptUploadScreen: React.FC<Props> = ({ route, navigation }) => {
  const { groupId, fileType } = route.params ?? {};
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [sourceType, setSourceType] = useState<'camera' | 'gallery' | 'pdf'>('gallery');
  const { mutate: parseReceipt, isPending: parsing } = useParseReceipt();

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
      setSelectedName(result.assets[0].fileName ?? 'receipt.jpg');
      setMimeType(result.assets[0].mimeType ?? 'image/jpeg');
      setSourceType('camera');
    }
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
      setSelectedName(result.assets[0].fileName ?? 'receipt.jpg');
      setMimeType(result.assets[0].mimeType ?? 'image/jpeg');
      setSourceType('gallery');
    }
  };

  const handlePdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
      setSelectedName(result.assets[0].name);
      setMimeType(result.assets[0].mimeType ?? 'application/pdf');
      setSourceType('pdf');
    }
  };

  const handleAnalyze = () => {
    if (!selectedUri) return;
    parseReceipt(
      {
        fileUri: selectedUri,
        fileName: selectedName ?? 'receipt',
        mimeType,
        sourceType,
      },
      {
        onSuccess: (receipt) => {
          navigation.replace('ReceiptReview', { receiptId: receipt.id, groupId });
        },
      },
    );
  };

  return (
    <Screen scrollable={false}>
      <View style={styles.container}>
        <View style={styles.illustration}>
          <MaterialIcons name="document-scanner" size={64} color={Colors.primary} />
          <Text style={styles.heading}>Upload Receipt</Text>
          <Text style={styles.subheading}>
            AI will extract items, totals, and help you split the bill
          </Text>
        </View>

        {/* Upload Options */}
        {!selectedUri ? (
          <View style={styles.options}>
            {!fileType || fileType === 'image' ? (
              <>
                <OptionBtn
                  icon="camera-alt"
                  label="Take Photo"
                  color={Colors.success}
                  onPress={handleCamera}
                />
                <OptionBtn
                  icon="photo-library"
                  label="From Gallery"
                  color={Colors.primary}
                  onPress={handleGallery}
                />
              </>
            ) : null}
            {fileType === 'pdf' || !fileType ? (
              <OptionBtn
                icon="picture-as-pdf"
                label="Upload PDF"
                color={Colors.danger}
                onPress={handlePdf}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.preview}>
            {mimeType.startsWith('image') ? (
              <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <View style={styles.pdfPreview}>
                <MaterialIcons name="picture-as-pdf" size={48} color={Colors.danger} />
                <Text style={styles.pdfName} numberOfLines={2}>{selectedName}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setSelectedUri(null)} style={styles.removeBtn}>
              <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedUri && (
          <Button
            title={parsing ? 'Analyzing with AI...' : 'Analyze Receipt'}
            onPress={handleAnalyze}
            loading={parsing}
            fullWidth
            size="lg"
            style={styles.analyzeBtn}
            leftIcon={!parsing ? <MaterialIcons name="auto-awesome" size={18} color={Colors.white} /> : undefined}
          />
        )}

        {parsing && (
          <Text style={styles.parsingHint}>
            AI is reading your receipt. This usually takes a few seconds...
          </Text>
        )}
      </View>
    </Screen>
  );
};

const OptionBtn: React.FC<{
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.optionBtn} onPress={onPress}>
    <View style={[styles.optionIcon, { backgroundColor: color + '20' }]}>
      <MaterialIcons name={icon} size={28} color={color} />
    </View>
    <Text style={styles.optionLabel}>{label}</Text>
    <MaterialIcons name="chevron-right" size={20} color={Colors.gray300} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.xl, gap: Spacing.xl },
  illustration: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xl },
  heading: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  subheading: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  options: { gap: Spacing.sm },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.base,
    ...Shadows.sm,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { flex: 1, fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  preview: { alignItems: 'center', gap: Spacing.sm },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
  },
  pdfPreview: {
    width: '100%',
    height: 160,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pdfName: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.base,
  },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removeBtnText: { fontSize: Typography.sm, color: Colors.textSecondary },
  analyzeBtn: { marginTop: Spacing.sm },
  parsingHint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ReceiptUploadScreen;
