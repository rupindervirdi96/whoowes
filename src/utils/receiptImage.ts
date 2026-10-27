/**
 * Gets a receipt photo ready for the AI.
 *
 * Phone cameras produce 4000px+ photos (often HEIC on iPhone) that are too big
 * for the vision API (5 MB max per image) and slow to upload. Claude reads at
 * most ~1568px on the long edge anyway, so we resize to 1600px and re-encode
 * as JPEG. A typical receipt ends up around 300–600 KB.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export interface PreparedImage {
  base64: string;
  mimeType: 'image/jpeg';
  uri: string;
}

/** Strips a `data:image/...;base64,` prefix if the platform added one (web does). */
export function stripDataUrl(b64: string): string {
  const comma = b64.indexOf(',');
  return b64.startsWith('data:') && comma !== -1 ? b64.slice(comma + 1) : b64;
}

export async function prepareReceiptImage(uri: string, size?: { width?: number; height?: number }): Promise<PreparedImage> {
  let width = size?.width ?? 0;
  let height = size?.height ?? 0;
  if (!width || !height) {
    // Unknown size (e.g. picked from Files): decode once to find out.
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    width = probe.width;
    height = probe.height;
  }

  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) {
    context.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  if (!saved.base64) throw new Error('Could not encode the image');
  return { base64: stripDataUrl(saved.base64), mimeType: 'image/jpeg', uri: saved.uri };
}
