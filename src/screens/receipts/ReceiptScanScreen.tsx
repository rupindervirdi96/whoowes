import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { ReceiptSourceType } from '../../types';
import { useScanReceipt } from '../../hooks/useReceipts';
import { useEntitlements } from '../../hooks/useBilling';
import { useShowToast } from '../../store/uiStore';
import { MAX_FILE_SIZE_BYTES } from '../../constants';
import { PLANS } from '../../billing/plans';
import { USE_MOCK_API } from '../../config';
import { prepareReceiptImage, stripDataUrl } from '../../utils/receiptImage';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';

interface Picked {
  uri: string;
  mimeType: string;
  name: string;
  source: ReceiptSourceType;
  width?: number;
  height?: number;
}

const STEPS = ['Reading the receipt…', 'Finding line items…', 'Checking the totals…'];

const ReceiptScanScreen: React.FC<RootScreenProps<'ReceiptScan'>> = ({ route, navigation }) => {
  const t = useTheme();
  const groupId = route.params?.groupId;
  const showToast = useShowToast();
  const scan = useScanReceipt();
  const { plan, scansLeft, subscription } = useEntitlements();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [instructions, setInstructions] = useState('');
  const [step, setStep] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!scan.isPending) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => {
      clearInterval(id);
      loop.stop();
      pulse.setValue(0);
    };
  }, [scan.isPending, pulse]);

  // Photos are shrunk before upload, so only PDFs have a hard size limit.
  const tooBig = (size?: number | null) => {
    if (size && size > MAX_FILE_SIZE_BYTES) {
      showToast('That PDF is over 10 MB. Try a smaller file.', 'warning');
      return true;
    }
    return false;
  };

  const fromImagePicker = async (source: 'camera' | 'gallery') => {
    // The system photo picker needs no permission (and the app doesn't request
    // photo-library access, which Google Play restricts); only the camera does.
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      showToast('Allow camera access in Settings to scan receipts.', 'warning');
      return;
    }
    // Full quality here; the photo is resized and compressed just before upload.
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setPicked({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? 'receipt.jpg',
      source,
      width: asset.width,
      height: asset.height,
    });
  };

  const fromFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const mimeType = asset.mimeType ?? (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    if (mimeType === 'application/pdf' && tooBig(asset.size)) return;
    setPicked({ uri: asset.uri, mimeType, name: asset.name, source: mimeType === 'application/pdf' ? 'pdf' : 'gallery' });
  };

  const [preparing, setPreparing] = useState(false);

  const read = async () => {
    if (!picked) return;
    let file: { base64: string; mimeType: string };
    setPreparing(true);
    try {
      if (picked.mimeType.startsWith('image/')) {
        // Resize + convert to JPEG (also turns iPhone HEIC photos into something the AI accepts).
        const img = await prepareReceiptImage(picked.uri, { width: picked.width, height: picked.height });
        file = { base64: img.base64, mimeType: img.mimeType };
      } else {
        file = { base64: stripDataUrl(await new File(picked.uri).base64()), mimeType: picked.mimeType };
      }
    } catch {
      showToast("Couldn't open that file. Try another one.", 'error');
      return;
    } finally {
      setPreparing(false);
    }
    scan.mutate(
      {
        file,
        fileUri: picked.uri,
        fileName: picked.name,
        sourceType: picked.source,
        instructions: instructions.trim() || undefined,
      },
      { onSuccess: (receipt) => navigation.replace('ReceiptReview', { receiptId: receipt.id, groupId }) },
    );
  };

  const outOfScans = scansLeft === 0;
  const limit = subscription?.scansLimit;

  return (
    <Screen
      footer={
        picked ? (
          outOfScans ? (
            <Button title="Get more scans" variant="pro" size="lg" fullWidth onPress={() => navigation.navigate('Plans', { feature: 'receipt_scan' })} />
          ) : (
            <Button
              title={preparing ? 'Preparing photo…' : scan.isPending ? STEPS[step] : 'Read receipt'}
              icon="auto-awesome"
              size="lg"
              fullWidth
              loading={preparing || scan.isPending}
              onPress={read}
            />
          )
        ) : undefined
      }
    >
      {USE_MOCK_API ? (
        <Card variant="alt" padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: t.spacing.base }}>
          <Icon name="info-outline" size={18} color={t.colors.textSecondary} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            Demo mode: the AI isn’t connected, so you’ll get a sample receipt instead of yours.
          </Text>
        </Card>
      ) : null}

      {plan !== 'pro' && limit != null ? (
        <Pressable onPress={() => navigation.navigate('Plans', { feature: 'receipt_scan' })} accessibilityRole="button">
          <Card variant="alt" padding={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: t.spacing.base }}>
            <Icon name="document-scanner" size={20} color={outOfScans ? t.colors.negative : t.colors.primary} />
            <Text variant="label" style={{ flex: 1 }} tone={outOfScans ? 'negative' : 'default'}>
              {outOfScans
                ? `You've used all ${limit} scans on ${PLANS[plan].name} this month`
                : `${scansLeft} of ${limit} AI scans left this month`}
            </Text>
            <Text variant="label" tone="primary">
              {plan === 'free' ? 'Upgrade' : 'Go unlimited'}
            </Text>
          </Card>
        </Pressable>
      ) : null}

      {!picked ? (
        <>
          <View style={{ alignItems: 'center', paddingVertical: t.spacing.xl }}>
            <View
              style={{
                width: 120,
                height: 150,
                borderRadius: 20,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: t.colors.primary,
                backgroundColor: t.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="receipt-long" size={56} color={t.colors.primary} />
            </View>
            <Text variant="h2" align="center" style={{ marginTop: t.spacing.lg }}>
              Snap it, we’ll split it
            </Text>
            <Text tone="secondary" align="center" style={{ marginTop: 6, maxWidth: 300 }}>
              AI reads every line item, tax and tip. You just tap who had what.
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            <SourceButton icon="photo-camera" title="Take a photo" body="Best results: flat, well lit, whole receipt" onPress={() => fromImagePicker('camera')} />
            <SourceButton icon="photo-library" title="Choose from photos" onPress={() => fromImagePicker('gallery')} />
            <SourceButton icon="picture-as-pdf" title="Upload a PDF or file" body="E-receipts and invoices" onPress={fromFiles} />
          </View>
        </>
      ) : (
        <>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {picked.mimeType.startsWith('image') ? (
              <View>
                <Image source={{ uri: picked.uri }} style={{ width: '100%', height: 320 }} resizeMode="cover" accessibilityLabel="Receipt preview" />
                {scan.isPending ? (
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: 3,
                      backgroundColor: t.brand.citrus,
                      shadowColor: t.brand.citrus,
                      shadowOpacity: 0.9,
                      shadowRadius: 10,
                      transform: [{ translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 317] }) }],
                    }}
                  />
                ) : null}
              </View>
            ) : (
              <View style={{ height: 180, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: t.colors.surfaceAlt }}>
                <Icon name="picture-as-pdf" size={48} color={t.colors.negative} />
                <Text variant="label" numberOfLines={1} style={{ maxWidth: '80%' }}>
                  {picked.name}
                </Text>
              </View>
            )}
          </Card>
          {!scan.isPending ? (
            <Button title="Choose a different file" variant="ghost" icon="refresh" onPress={() => setPicked(null)} style={{ marginTop: 6 }} />
          ) : null}

          <Input
            label="Anything the AI should know? (optional)"
            value={instructions}
            onChangeText={setInstructions}
            placeholder="e.g. Ignore the service charge, it's in euros"
            containerStyle={{ marginTop: t.spacing.base }}
            editable={!scan.isPending}
          />
          <Badge label="Your receipt is only used to read the items" icon="lock-outline" tone="neutral" />
        </>
      )}
    </Screen>
  );
};

const SourceButton: React.FC<{ icon: string; title: string; body?: string; onPress: () => void }> = ({ icon, title, body, onPress }) => {
  const t = useTheme();
  return (
    <Card onPress={onPress} padding={14} accessibilityLabel={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={22} color={t.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          {body ? (
            <Text variant="caption" tone="tertiary">
              {body}
            </Text>
          ) : null}
        </View>
        <Icon name="chevron-right" color={t.colors.textTertiary} />
      </View>
    </Card>
  );
};

export default ReceiptScanScreen;
