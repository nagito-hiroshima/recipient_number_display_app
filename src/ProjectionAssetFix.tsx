import React, { useEffect } from 'react';

const PRESET_ASSETS: Record<string, string> = {
  '準備中': '/projection/prepare.webp?v=20260916-2',
  '営業中': '/projection/open.webp?v=20260916-2',
  'タイムセール中': '/projection/sale.webp?v=20260916-2',
  'モバイルオーダー受付中': '/projection/mobile.webp?v=20260916-2',
  '本日終了': '/projection/closed.webp?v=20260916-2',
};

const FILE_ASSETS: Record<string, string> = {
  prepare: PRESET_ASSETS['準備中'],
  open: PRESET_ASSETS['営業中'],
  sale: PRESET_ASSETS['タイムセール中'],
  mobile: PRESET_ASSETS['モバイルオーダー受付中'],
  closed: PRESET_ASSETS['本日終了'],
};

function resolvePresetAsset(value: string): string | null {
  // ProjectionRuntime の旧ViteアセットURLを public/projection の固定URLへ差し替える。
  // 開発時の /src/assets/projection/foo.webp と、本番ビルド後の
  // /assets/foo-HASH.webp のどちらにも対応する。
  for (const [name, fixedUrl] of Object.entries(FILE_ASSETS)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sourcePattern = new RegExp(`(?:/assets/projection/|/src/assets/projection/)${escaped}\\.webp(?:[?#].*)?$`, 'i');
    const builtPattern = new RegExp(`/assets/${escaped}(?:-[^/?]+)?\\.webp(?:[?#].*)?$`, 'i');
    if (sourcePattern.test(value) || builtPattern.test(value)) return fixedUrl;
  }
  return null;
}

export const ProjectionAssetFix: React.FC = () => {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const fixedUrl = resolvePresetAsset(rawUrl);
      return originalFetch(fixedUrl ?? input, init);
    }) as typeof window.fetch;

    const repairPresetThumbnails = () => {
      const images = document.querySelectorAll<HTMLImageElement>('img[alt$="の投影素材"]');
      images.forEach((image) => {
        const title = image.alt.replace(/の投影素材$/, '');
        const fixedUrl = PRESET_ASSETS[title];
        if (!fixedUrl) return;

        const fixedAbsoluteUrl = new URL(fixedUrl, window.location.origin).href;
        if (image.src !== fixedAbsoluteUrl) image.src = fixedUrl;
      });
    };

    repairPresetThumbnails();
    const observer = new MutationObserver(repairPresetThumbnails);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.fetch = originalFetch as typeof window.fetch;
    };
  }, []);

  return null;
};
