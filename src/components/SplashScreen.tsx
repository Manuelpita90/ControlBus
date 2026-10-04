import React, { useEffect, useState } from 'react';
import { Bus } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(25);
  const [stepText, setStepText] = useState('Conectando a Firebase (buscontrol-app-ce582)...');

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setProgress(60);
      setStepText('Sincronizando datos con la nube en tiempo real...');
    }, 350);

    const timer2 = setTimeout(() => {
      setProgress(100);
      setStepText('¡Listo! Base de datos sincronizada... 100%');
    }, 750);

    const timer3 = setTimeout(() => onFinish(), 1200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0B132B] flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Glow backgrounds */}
      <div className="absolute w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute w-56 h-56 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

      {/* Main Title */}
      <h1 className="text-3xl sm:text-4xl font-black text-white tracking-wider mb-1">
        BusControl
      </h1>
      <p className="text-xs sm:text-sm text-slate-300 font-medium tracking-wide mb-8">
        Sistema Integral de Gestión y Control
      </p>

      {/* Circular Bus Graphic with Neon Rings */}
      <div className="relative my-4">
        <div className="w-36 h-36 rounded-full border-2 border-emerald-400/40 p-2 shadow-xl shadow-cyan-500/10 flex items-center justify-center bg-gradient-to-tr from-[#1C2541] to-[#0E172E]">
          <div className="w-28 h-28 rounded-full border border-cyan-400/60 flex items-center justify-center bg-[#0B132B]">
            <Bus className="w-14 h-14 text-white drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
          </div>
        </div>
      </div>

      {/* AJP-Logic Pill */}
      <div className="my-6">
        <div className="inline-block px-5 py-1.5 rounded-full bg-[#1C2541] border border-cyan-400/40 text-cyan-300 font-bold text-sm tracking-widest shadow-md">
          • AJP-Logic •
        </div>
      </div>

      {/* Progress Bar & Status */}
      <div className="w-full max-w-xs space-y-2 mt-2">
        <p className="text-xs font-semibold text-emerald-400 min-h-[1.25rem]">
          {stepText}
        </p>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400">Conectando a Firebase RTDB Cloud</p>
      </div>
    </div>
  );
};
