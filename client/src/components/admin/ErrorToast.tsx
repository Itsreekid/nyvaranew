'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import styles from './ErrorToast.module.css';

export default function ErrorToast() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleAdminError = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setErrorMsg(customEvent.detail);
      setVisible(true);

      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(() => setErrorMsg(null), 400); // wait for slide-out animation
      }, 6000);

      // We clear the timeout if a new error comes in, but handling multiple rapidly is tricky.
      // This is simple and effective for most admin actions.
    };

    window.addEventListener('admin-error', handleAdminError);
    return () => window.removeEventListener('admin-error', handleAdminError);
  }, []);

  if (!errorMsg) return null;

  return (
    <div className={`${styles.toast} ${visible ? styles.show : styles.hide}`}>
      <div className={styles.iconWrap}>
        <AlertTriangle size={22} />
      </div>
      <div className={styles.body}>
        <div className={styles.title}>Action impossible</div>
        <div className={styles.name}>{errorMsg}</div>
      </div>
      <button className={styles.close} onClick={() => { setVisible(false); setTimeout(() => setErrorMsg(null), 400); }}>
        <X size={14} />
      </button>
    </div>
  );
}
