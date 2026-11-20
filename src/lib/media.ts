import manifestData from '../data/media-manifest.json' with {
  type: 'json',
};

interface NodeFs {
  existsSync(p: string): boolean;
}

interface NodePath {
  join(...paths: string[]): string;
}

// ponytail: Checks local disk cache to enable offline dev preview before upload
function hasLocalVariant(key?: string): boolean {
  if (!key) return false;
  try {
    const g = globalThis as {
      process?: {
        cwd?: () => string;
        getBuiltinModule?: (id: string) => unknown;
      };
    };
    const getMod = g.process?.getBuiltinModule;
    if (!getMod || !g.process?.cwd) return false;
    const fsMod = getMod('node:fs') as NodeFs | undefined;
    const pathMod = getMod('node:path') as NodePath | undefined;
    if (!fsMod || !pathMod) return false;
    const localPath = pathMod.join(g.process.cwd(), '.local-media', key);
    return fsMod.existsSync(localPath);
  } catch {
    return false;
  }
}

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
  const g = globalThis as {
    process?: { env?: Record<string, string | undefined> };
    __SHAN_TEST_MANIFEST__?: typeof manifestData;
  };
  const isDev =
    import.meta.env?.DEV ?? (g.process?.env?.NODE_ENV !== 'production');
  const configuredBase =
    import.meta.env?.PUBLIC_MEDIA_BASE_URL ??
    g.process?.env?.PUBLIC_MEDIA_BASE_URL;

  const cleanId = mediaId.replace(/^media:/, '');
  const activeManifest = g.__SHAN_TEST_MANIFEST__ || manifestData;
  const items = activeManifest.items as Record<string, MediaItem>;
  const item = items[cleanId];

  if (!item) {
    if (!isDev) {
      throw new Error(
        `[media-resolver] Production build failed: Missing media ID ` +
        `'${mediaId}' in media manifest.`
      );
    }
    console.warn(`[media-resolver] Missing manifest entry: ${mediaId}`);
    return {
      src: '/media/placeholder.webp',
      srcSet: '/media/placeholder.webp 1x',
      avifSrcSet: '',
      thumbnailSrc: '/media/placeholder.webp',
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
    };
  }

  const v = item.variants;
  if (!isDev && (!v?.thumb400 || !v?.card800 || !v?.full1600)) {
    throw new Error(
      `[media-resolver] Production build failed: Media item '${mediaId}' ` +
      `is missing required variants.`
    );
  }

  let base: string;
  if (isDev) {
    const hasLocal = hasLocalVariant(v?.card800?.key);
    base = hasLocal
      ? '/media'
      : (configuredBase || '/media').replace(/\/$/, '');
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
