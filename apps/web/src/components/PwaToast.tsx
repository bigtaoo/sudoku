import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Tells the player when the app works offline and when a new version is waiting. */
export function PwaToast() {
  const { t } = useTranslation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // An installed app can stay open for days; look for new versions now and then.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const id = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-sm items-center gap-3 rounded-lg bg-ink px-4 py-3 text-sm text-bg shadow-lg"
    >
      <span className="flex-1">{needRefresh ? t('pwa.update') : t('pwa.offlineReady')}</span>
      {needRefresh && (
        <>
          <button type="button" onClick={() => setNeedRefresh(false)} className="opacity-70">
            {t('pwa.later')}
          </button>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="rounded-md bg-accent px-3 py-1 font-medium text-accent-ink"
          >
            {t('pwa.reload')}
          </button>
        </>
      )}
    </div>
  );
}
