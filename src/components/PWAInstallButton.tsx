import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { Download, Smartphone, X, Share } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'header';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // If already running as an installed standalone PWA, suppress
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop PC Chrome flow
  if (isInstallable) {
    if (variant === 'header') {
      return (
        <button
          onClick={install}
          className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md transition-all transform hover:scale-105"
          title="Instalar BusControl en tu PC o teléfono"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      );
    }

    if (variant === 'full') {
      return (
        <button
          onClick={install}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Instalar BusControl como Aplicación (PWA)</span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className="flex items-center space-x-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-xs transition-colors"
      >
        <Smartphone className="w-4 h-4" />
        <span>Instalar PWA</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center space-x-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-[#1C2541] border border-slate-700 p-6 shadow-2xl text-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  <span>Instalar en iPhone / iPad</span>
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <p>
                    Toca el botón <strong>Compartir</strong> <Share className="w-3.5 h-3.5 inline mx-1 text-cyan-400" /> en la barra inferior de Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <p>
                    Desliza hacia abajo en las opciones y selecciona <strong>"Agregar a la pantalla de inicio"</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <p>
                    Confirma arriba en <strong>"Agregar"</strong>. ¡BusControl aparecerá como icono de app independiente!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback desktop generic button (guides PC users how to install via browser address bar or menu)
  return (
    <>
      <button
        onClick={() => setShowHelpModal(true)}
        className="flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
        title="Instalar BusControl en tu dispositivo"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>

      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#1C2541] border border-slate-700 p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-amber-400" />
                <span>Instalar BusControl</span>
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-[#0B132B] rounded-xl border border-slate-800 space-y-2">
                <p className="font-semibold text-white">En Google Chrome / Microsoft Edge en PC:</p>
                <p>
                  1. Haz clic en el icono <strong>⊕ ("Instalar BusControl")</strong> que aparece al final de la barra de direcciones de tu navegador.
                </p>
                <p>
                  2. O abre el menú del navegador (tres puntos ⋮ arriba a la derecha) y haz clic en <strong>"Instalar BusControl"</strong>.
                </p>
              </div>

              <div className="p-3 bg-[#0B132B] rounded-xl border border-slate-800 space-y-2">
                <p className="font-semibold text-white">En Teléfonos Android:</p>
                <p>Abre el menú ⋮ de Chrome y selecciona <strong>"Agregar a la pantalla principal"</strong>.</p>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
