import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { firebaseConfig } from '../components/FirebaseConfig';
import { initializeApp, getApps } from 'firebase/app';

export function useInflateables() {
  const [inflateables, setInflateables] = useState<any[]>([]);

  useEffect(() => {
    if (!getApps().length) {
      initializeApp(firebaseConfig);
    }
    const db = getDatabase();
    const inflateablesRef = ref(db, 'inflateables');
    onValue(inflateablesRef, (snapshot) => {
      const val = snapshot.val();
      if (Array.isArray(val)) {
        setInflateables(val);
      } else if (val && typeof val === 'object') {
        setInflateables(Object.values(val));
      } else {
        setInflateables([]);
      }
    });
  }, []);

  return inflateables;
}
