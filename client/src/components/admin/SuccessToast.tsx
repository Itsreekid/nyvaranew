'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import styles from './SuccessToast.module.css';

export default function SuccessToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleSuccess = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setMsg(customEvent.detail);
      setVisible(true);

      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(() => setMsg(null), 400); // wait for slide-out animation
      }, 4000); // 4 seconds for success
    };

    window.addEventListener('admin-success', handleSuccess);
    return () => window.removeEventListener('admin-success', handleSuccess);
  }, []);

  if (!msg) return null;

  return (
    <div className={`${styles.toast} ${visible ? styles.show : styles.hide}`}>
      <div className={styles.iconWrap}>
        <CheckCircle2 size={22} />
      </div>
      <div className={styles.body}>
        <div className={styles.title}>Succès</div>
        <div className={styles.name}>{msg}</div>
      </div>
      <button className={styles.close} onClick={() => { setVisible(false); setTimeout(() => setMsg(null), 400); }}>
        <X size={14} />
      </button>
    </div>
  );
}
