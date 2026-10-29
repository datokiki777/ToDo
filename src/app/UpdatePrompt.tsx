import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToasts } from '@/core/ui/toasts';

/** Tells people a new version is ready, and lets them choose when to reload. */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    showToast(t('pwa.updateReady'), {
      actionLabel: t('pwa.update'),
      onAction: () => void updateServiceWorker(true),
      durationMs: 60_000,
    });
    setNeedRefresh(false);
  }, [needRefresh, setNeedRefresh, showToast, t, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;
    showToast(t('pwa.offlineReady'));
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, showToast, t]);

  return null;
}
