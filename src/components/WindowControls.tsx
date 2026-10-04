import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Minus, X, CheckCircle, ShieldAlert } from 'lucide-react';

export const WindowControls: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  };

  const handleMinimize = async () => {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } else {
      // In PWA/browser, inform the user or minimize view
      // Browsers don't allow script to minimize the OS window for security,
      // but in Windows/Mac PWA the top system titlebar has the native minimize button.
      alertMinimizeHint();
    }
  };

  const [showMinHint, setShowMinHint] = useState(false);
  const alertMinimizeHint = () => {
    setShowMinHint(true);
    setTimeout(() => setShowMinHint(false), 3500);
  };

  const handleClose = () => {
    setShowCloseModal(true);
  };

  const confirmClose = () => {
    setShowCloseModal(false);
    // Attempt window.close()
    window.close();
    // Fallback if window was not opened by script and browser prevents direct closure
    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 300);
  };

  return (
    <>
      {/* Desktop Window Control Buttons */}
      <div className="flex items-center space-x-1 bg-[#1C2541]/90 border border-slate-700/80 rounded-xl px-1.5 py-1 shadow-inner">
        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/70 transition-colors"
          title={isFullscreen ? 'Restaurar pantalla' : 'Minimizar ventana'}
          aria-label="Minimizar"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen / Maximize Toggle Button */}
        <button
          onClick={toggleFullscreen}
          className={`p-1.5 rounded-lg transition-colors ${
            isFullscreen
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/70'
          }`}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label="Pantalla Completa"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-red-600 transition-colors"
          title="Cerrar aplicación"
          aria-label="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Minimize Toast Notification */}
      {showMinHint && (
        <div className="fixed top-16 right-4 z-50 bg-[#1C2541] border border-cyan-500/40 text-cyan-200 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <span>Usa la tecla <strong>Alt + Tab</strong> o el botón <strong>—</strong> de tu barra de tareas para minimizar.</span>
        </div>
      )}

      {/* Close Confirmation Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">¿Cerrar BusControl?</h3>
                <p className="text-xs text-slate-400">Confirmación de salida</p>
              </div>
            </div>

            <div className="p-3 bg-[#0B132B] rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Base de datos segura</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Todos tus ingresos, gastos, facturas y ajustes se encuentran guardados y respaldados en la nube de Firebase.
              </p>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
              >
                Permanecer
              </button>
              <button
                onClick={confirmClose}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
