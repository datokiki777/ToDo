import { ChevronDown, Eye, EyeOff, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { authErrorKey, isCancellation } from './errors';
import { SyncPanel } from '@/features/sync/SyncPanel';
import { useAccount } from './store';
import { emailProblem, MIN_PASSWORD_LENGTH, passwordProblem } from './validation';
import styles from './AccountSection.module.css';

type Message = { kind: 'error' | 'info'; key: string; values?: Record<string, string> };

export function AccountSection() {
  const { t } = useTranslation();
  const status = useAccount((s) => s.status);
  const user = useAccount((s) => s.user);
  const busy = useAccount((s) => s.busy);
  const signInWithGoogle = useAccount((s) => s.signInWithGoogle);
  const signIn = useAccount((s) => s.signIn);
  const signUp = useAccount((s) => s.signUp);
  const signOut = useAccount((s) => s.signOut);
  const sendPasswordReset = useAccount((s) => s.sendPasswordReset);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const fail = (code: string) =>
    setMessage({ kind: isCancellation(code) ? 'info' : 'error', key: authErrorKey(code), values: { code } });

  const google = async () => {
    setMessage(null);
    const result = await signInWithGoogle();
    if (!result.ok) fail(result.code);
  };

  const submit = async (mode: 'signIn' | 'signUp') => {
    setMessage(null);
    const problem = emailProblem(email) ?? (mode === 'signUp' ? passwordProblem(password) : password === '' ? 'account.errorCredentials' : null);
    if (problem) return setMessage({ kind: 'error', key: problem });
    const result = await (mode === 'signIn' ? signIn : signUp)(email, password);
    if (result.ok) setPassword('');
    else fail(result.code);
  };

  const reset = async () => {
    setMessage(null);
    const problem = emailProblem(email);
    if (problem) return setMessage({ kind: 'error', key: 'account.resetNeedsEmail' });
    const result = await sendPasswordReset(email);
    if (result.ok) setMessage({ kind: 'info', key: 'account.resetSent', values: { email: email.trim() } });
    else fail(result.code);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit('signIn');
  };

  return (
    <section className={styles.section} aria-labelledby="account-heading">
      <h2 id="account-heading" className={styles.heading}>
        {t('account.title')}
      </h2>

      {(status === 'idle' || status === 'starting') && <p className={styles.hint}>{t('account.loading')}</p>}
      {status === 'unavailable' && <p className={styles.hint}>{t('account.unavailable')}</p>}

      {status === 'signedIn' && user && (
        <>
          <p className={styles.signedIn}>{t('account.signedInAs', { email: user.email })}</p>
          <SyncPanel />
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.button}
              disabled={busy}
              onClick={() => void signOut().then((r) => !r.ok && fail(r.code))}
            >
              {t('account.signOut')}
            </button>
          </div>
          {message && <p className={styles.error}>{t(message.key, message.values)}</p>}
        </>
      )}

      {status === 'signedOut' && (
        <>
          <p className={styles.hint}>{t('account.intro')}</p>

          <button type="button" className={`${styles.button} ${styles.primary} ${styles.google}`} disabled={busy} onClick={() => void google()}>
            <LogIn size={20} aria-hidden="true" />
            {t('account.google')}
          </button>

          {message && (
            <p className={message.kind === 'error' ? styles.error : styles.info} role="alert">
              {t(message.key, message.values)}
            </p>
          )}

          <button
            type="button"
            className={styles.link}
            aria-expanded={emailOpen}
            onClick={() => setEmailOpen((open) => !open)}
          >
            {t('account.useEmail')}
            <ChevronDown size={18} className={emailOpen ? styles.chevronOpen : undefined} aria-hidden="true" />
          </button>

          {emailOpen && (
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <label className={styles.field}>
                <span className={styles.label}>{t('account.email')}</span>
                <input
                  className={styles.input}
                  type="email"
                  name="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{t('account.password')}</span>
                <span className={styles.passwordRow}>
                  <input
                    className={styles.input}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.eye}
                    aria-label={showPassword ? t('account.hidePassword') : t('account.showPassword')}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </span>
                <span className={styles.note}>{t('account.passwordHint', { count: MIN_PASSWORD_LENGTH })}</span>
                <span className={styles.note}>{t('account.emailOwnPassword')}</span>
              </label>

              <div className={styles.buttons}>
                <button type="submit" className={styles.button} disabled={busy}>
                  {t('account.signIn')}
                </button>
                <button type="button" className={styles.button} disabled={busy} onClick={() => void submit('signUp')}>
                  {t('account.signUp')}
                </button>
              </div>
              <button type="button" className={styles.link} disabled={busy} onClick={() => void reset()}>
                {t('account.forgot')}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
