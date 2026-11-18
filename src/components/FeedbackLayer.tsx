import React from 'react';
import { Trophy, Sparkles, Coins, Flame, X, PartyPopper } from 'lucide-react';
import { FloatingFeedback, ToastNotification } from '../types';

interface FeedbackLayerProps {
  floatingItems: FloatingFeedback[];
  toasts: ToastNotification[];
  levelUpModal: { level: number } | null;
  onCloseLevelUp: () => void;
  onDismissToast: (id: string) => void;
}

export const FeedbackLayer: React.FC<FeedbackLayerProps> = ({
  floatingItems,
  toasts,
  levelUpModal,
  onCloseLevelUp,
  onDismissToast,
}) => {
  return (
    <>
      {/* 1. Floating Numbers at Click Position */}
      <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden">
        {floatingItems.map((item) => (
          <div
            key={item.id}
            style={{
              left: `${Math.min(window.innerWidth - 150, Math.max(20, item.x - 55))}px`,
              top: `${Math.max(40, item.y - 24)}px`,
            }}
            className="fixed animate-float-up flex flex-col items-center gap-0.5 select-none"
          >
            {item.damageText && (
              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white font-mono font-black text-xs sm:text-sm shadow-lg">
                {item.damageText}
              </span>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131A2A]/95 border border-violet-400/50 shadow-xl">
              <span className="font-mono font-extrabold text-xs sm:text-sm text-emerald-400">
                {item.xpText}
              </span>
              {item.coinText && (
                <span className="font-mono font-extrabold text-xs sm:text-sm text-amber-400">
                  {item.coinText}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Toast Celebration Notifications */}
      <div className="fixed bottom-5 right-5 z-[65] flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-[#131A2A]/95 backdrop-blur-md border-2 rounded-2xl p-4 shadow-2xl flex items-start justify-between gap-3 transition-all ${
              toast.type === 'reward'
                ? 'border-amber-400/70 shadow-amber-500/15'
                : toast.type === 'boss'
                ? 'border-emerald-400/70 shadow-emerald-500/15'
                : 'border-violet-500/60 shadow-violet-500/15'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  toast.type === 'reward'
                    ? 'bg-amber-500/20 text-amber-400'
                    : toast.type === 'boss'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-violet-500/20 text-violet-400'
                }`}
              >
                {toast.type === 'reward' ? (
                  <PartyPopper className="w-5 h-5" />
                ) : toast.type === 'boss' ? (
                  <Trophy className="w-5 h-5" />
                ) : (
                  <Flame className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">{toast.title}</h4>
                {toast.subtitle && (
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    {toast.subtitle}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => onDismissToast(toast.id)}
              className="text-slate-500 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* 3. Celebratory Level Up Modal */}
      {levelUpModal && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131A2A] border-2 border-violet-500 rounded-3xl max-w-md w-full p-7 text-center shadow-[0_0_60px_rgba(139,92,246,0.35)] space-y-5 relative overflow-hidden">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-56 h-56 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] mx-auto flex items-center justify-center shadow-xl shadow-violet-500/30">
              <Trophy className="w-10 h-10 text-amber-300 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                LEVEL UP ALCANÇADO!
              </span>
              <h3 className="text-3xl font-black text-white">
                Nível {levelUpModal.level} Desbloqueado!
              </h3>
              <p className="text-sm text-slate-300">
                Cada micro-passo vencido fortalece seu foco. Orgulhe-se do seu progresso!
              </p>
            </div>

            <div className="bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-3.5 flex items-center justify-center gap-4 text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Sparkles className="w-4 h-4" /> Dopamina Recarregada
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <Coins className="w-4 h-4" /> Loja Liberada
              </span>
            </div>

            <button
              type="button"
              onClick={onCloseLevelUp}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] text-white font-extrabold text-sm shadow-lg shadow-violet-600/30 transition-all active:scale-95"
            >
              Continuar Aventura!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
