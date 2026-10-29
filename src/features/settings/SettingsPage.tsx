import { Download, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/core/i18n/languages';
import { useSettings, type ThemePreference } from '@/core/settings/store';
import { getPersistState, requestPersistence, type PersistState } from '@/core/storage';
import { PageHeader } from '@/core/ui/PageHeader';
import { Segmented } from '@/core/ui/Segmented';
import { useToasts } from '@/core/ui/toasts';
import { BackupError, downloadBackup, restoreBackup } from '@/features/backup/backup';
import styles from './SettingsPage.module.css';

const ERROR_KEYS = {
  'invalid-json': 'settings.errorInvalidJson',
  'not-a-backup': 'settings.errorNotBackup',
  'unsupported-version': 'settings.errorUnsupportedVersion',
} as const;

export function SettingsPage() {
  const { t } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const language = useSettings((s) => s.language);
  const theme = useSettings((s) => s.theme);
  const setLanguage = useSettings((s) => s.setLanguage);
  const setTheme = useSettings((s) => s.setTheme);
  const fileInput = useRef<HTMLInputElement>(null);
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    void getPersistState().then(setPersist);
  }, []);

  const exportBackup = async () => {
    const count = await downloadBackup();
    showToast(t('settings.exported', { count }));
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const result = await restoreBackup(await file.text());
      const summary = t('settings.imported', {
        added: result.added,
        updated: result.updated,
        skipped: result.skipped,
      });
      showToast(result.invalid > 0 ? `${summary} ${t('settings.importedInvalid', { count: result.invalid })}` : summary, {
        durationMs: 8000,
      });
    } catch (error) {
      showToast(error instanceof BackupError ? t(ERROR_KEYS[error.code]) : t('settings.errorGeneric'), {
        durationMs: 8000,
      });
    }
  };

  const askPersistence = async () => {
    const state = await requestPersistence();
    setPersist(state);
    setDenied(state === 'not-persisted');
  };

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ];

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className={styles.page}>
        <section className={styles.section}>
          <h2 className={styles.heading}>{t('settings.language')}</h2>
          <Segmented
            label={t('settings.language')}
            value={language}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            onChange={setLanguage}
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{t('settings.theme')}</h2>
          <Segmented label={t('settings.theme')} value={theme} options={themeOptions} onChange={setTheme} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{t('settings.backup')}</h2>
          <p className={styles.hint}>{t('settings.backupHint')}</p>
          <div className={styles.buttons}>
            <button type="button" className={styles.button} onClick={() => void exportBackup()}>
              <Download size={20} />
              {t('settings.export')}
            </button>
            <button type="button" className={styles.button} onClick={() => fileInput.current?.click()}>
              <Upload size={20} />
              {t('settings.import')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => void importBackup(event)}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{t('settings.storage')}</h2>
          <p className={styles.hint}>
            {persist === 'persisted' && t('settings.storageOn')}
            {persist === 'not-persisted' && t('settings.storageOff')}
            {persist === 'unsupported' && t('settings.storageUnknown')}
          </p>
          {persist === 'not-persisted' && (
            <>
              <div className={styles.buttons}>
                <button type="button" className={styles.button} onClick={() => void askPersistence()}>
                  {t('settings.storageRequest')}
                </button>
              </div>
              {denied && <p className={styles.hint}>{t('settings.storageDenied')}</p>}
            </>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{t('settings.about')}</h2>
          <p className={styles.hint}>
            ToDo · {t('settings.version', { version: __APP_VERSION__, build: __APP_BUILD__ })}
          </p>
        </section>
      </div>
    </>
  );
}
