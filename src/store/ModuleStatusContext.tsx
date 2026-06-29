import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { datingApi } from '../api/dating';
import { penpalApi } from '../api/penpal';
import { getUser } from './auth';

export type DatingType = 'NonSpiritual' | 'Spiritual';

interface ModuleStatus {
  isMentor: boolean;
  hasDating: boolean;
  datingType: DatingType | null;
  hasPenpal: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ModuleStatusContext = createContext<ModuleStatus | null>(null);

export function ModuleStatusProvider({ children }: { children: React.ReactNode }) {
  const [isMentor, setIsMentor] = useState(false);
  const [hasDating, setHasDating] = useState(false);
  const [datingType, setDatingType] = useState<DatingType | null>(null);
  const [hasPenpal, setHasPenpal] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const user = await getUser();
      const mentor = user?.role === 'Mentor';
      setIsMentor(mentor);

      if (!mentor) {
        const [datingResult, penpalResult] = await Promise.allSettled([
          datingApi.getProfile(),
          penpalApi.getProfile(),
        ]);

        const datingProfile = datingResult.status === 'fulfilled'
          ? (datingResult.value.data?.data ?? null)
          : null;
        setHasDating(!!datingProfile);
        setDatingType(datingProfile?.datingType ?? null);

        const penpalProfile = penpalResult.status === 'fulfilled'
          ? (penpalResult.value.data?.data ?? null)
          : null;
        setHasPenpal(!!penpalProfile);
      }
    } catch {
      // keep existing state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <ModuleStatusContext.Provider value={{ isMentor, hasDating, datingType, hasPenpal, loading, refresh }}>
      {children}
    </ModuleStatusContext.Provider>
  );
}

export function useModuleStatus(): ModuleStatus {
  const ctx = useContext(ModuleStatusContext);
  if (!ctx) throw new Error('useModuleStatus must be used within ModuleStatusProvider');
  return ctx;
}
