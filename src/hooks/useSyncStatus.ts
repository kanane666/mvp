import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatusChange } from '@/lib/sync';

export type SyncStatus = ReturnType<typeof getSyncStatus>;

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => {
    return onSyncStatusChange(setStatus);
  }, []);
  return status;
}
