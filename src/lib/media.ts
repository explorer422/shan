import manifestData from '../data/media-manifest.json';

export interface MediaVariant {
  key: string;
  w: number;
  h: number;
}

export interface MediaItem {
  id: string;
  storageKeyPrefix: string;
  format: string;
  width: number;
  height: number;
  aspectRatio: number;
  contentHash: string;
  blurDataURL?: string;
  variants: {
    thumb400: MediaVariant;
    card800: MediaVariant;
    full1600: MediaVariant;
    avif1600?: MediaVariant;
  };
  metadata?: {
    captureDate?: string;
    cameraModel?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: number;
  };
}

export interface ResolvedMedia {
  src: string;
  srcSet: string;
  avifSrcSet: string;
  thumbnailSrc: string;
  width: number;
  height: number;
  aspectRatio: number;
  blurDataURL?: string;
  metadata?: MediaItem['metadata'];
}

export function resolveMedia(mediaId: string): ResolvedMedia {
  const isDev = import.meta.env.DEV;
  const configuredBase = import.meta.env.PUBLIC_MEDIA_BASE_URL;

  let base: string;
  if (isDev) {
    base = (configuredBase || '/media').replace(/\/$/, '');
  } else {
    // Review Finding 3: Do not silently fallback to placeholder domain
    if (!configuredBase) {
      throw new Error(
        '[media-resolver] Production build requires PUBLIC_MEDIA_BASE_URL ' +
        'to be explicitly configured when resolving published media.'
      );
    }
    base = configuredBase.replace(/\/$/, '');
  }

  const cleanId = mediaId.replace(/^media:/, '');
  const items = manifestData.items as Record<string, MediaItem>;
  const item = items[cleanId];

  if (!item) {
    console.warn(`[media-resolver] Missing manifest entry: ${mediaId}`);
    return {
      src: `${base}/placeholder.webp`,
      srcSet: `${base}/placeholder.webp 1x`,
      avifSrcSet: '',
      thumbnailSrc: `${base}/placeholder.webp`,
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
    };
  }

  const v = item.variants;
  return {
    src: `${base}/${v.card800.key}`,
    srcSet: [
      `${base}/${v.thumb400.key} 400w`,
      `${base}/${v.card800.key} 800w`,
      `${base}/${v.full1600.key} 1600w`,
    ].join(', '),
    avifSrcSet: v.avif1600 ? `${base}/${v.avif1600.key} 1600w` : '',
    thumbnailSrc: `${base}/${v.thumb400.key}`,
    width: item.width,
    height: item.height,
    aspectRatio: item.aspectRatio,
    blurDataURL: item.blurDataURL,
    metadata: item.metadata,
  };
}
