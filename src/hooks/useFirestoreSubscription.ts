/**
 * EXTROVELA — useFirestoreSubscription (Phase 14)
 *
 * Wraps a bounded socialRealtime subscription in React lifecycle. It attaches on
 * mount (and whenever `deps` change) and — the whole point — returns the Firestore
 * `Unsubscribe` from `useEffect`'s cleanup, so a listener can never outlive the
 * component that opened it. This mirrors the `onAuthState` unsubscribe idiom in
 * AuthContext.
 *
 * Under local-first / test / placeholder creds the subscribe fn returns a no-op
 * unsubscribe synchronously (getDb() is null), so this hook just holds its
 * `initial` value, attaches nothing, and leaks nothing.
 */

import { useEffect, useState, type DependencyList } from 'react';
import type { Unsubscribe } from 'firebase/firestore';

export function useFirestoreSubscription<T>(
  subscribe: (onChange: (data: T) => void) => Unsubscribe,
  initial: T,
  deps: DependencyList
): T {
  const [data, setData] = useState<T>(initial);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribe(next => {
      // Guard against a snapshot landing after the component has torn down.
      if (active) setData(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
    // Subscribe identity intentionally excluded — callers key re-attachment on `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}

export default useFirestoreSubscription;
