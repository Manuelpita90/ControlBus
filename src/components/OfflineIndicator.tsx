import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-amber-500/90 backdrop-blur-md px-4 py-2 text-xs font-bold text-white shadow-xl border border-amber-400">
      <WifiOff className="w-4 h-4 text-white animate-pulse" />
      <span>Modo sin conexión — usando datos en caché de la PWA.</span>
    </div>
  );
};
