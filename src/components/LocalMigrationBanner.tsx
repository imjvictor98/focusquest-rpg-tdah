import React from 'react';
import { CloudUpload, Trash2, Sparkles, Loader2 } from 'lucide-react';
import type { AppState } from '../types';

interface LocalMigrationBannerProps {
  legacyState: AppState;
  importing: boolean;
  onImport: () => void;
  onDiscard: () => void;
}

export const LocalMigrationBanner: React.FC<LocalMigrationBannerProps> = ({
  legacyState,
  importing,
  onImport,
  onDiscard,
}) => {
  const activeQuestsCount = legacyState.quests.filter((q) => !q.completed).length;

  return (
    <div className="bg-gradient-to-r from-violet-950/80 via-[#131A2A] to-indigo-950/80 border border-violet-500/40 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-300 flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-white">
            Encontramos seu progresso antigo salvo neste navegador!
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Nível <strong className="text-violet-300">{legacyState.player.level}</strong> ·{' '}
            <strong className="text-amber-300">{legacyState.player.coins} moedas</strong> ·{' '}
            <strong className="text-white">{activeQuestsCount} missões ativas</strong>. Deseja
            migrar estes dados para o banco de dados na nuvem e limpar o armazenamento local?
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <button
          type="button"
          disabled={importing}
          onClick={onImport}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-violet-500/25 transition-all active:scale-95"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Migrando...</span>
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4" />
              <span>Importar para a Nuvem</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={importing}
          onClick={onDiscard}
          className="px-3.5 py-2.5 rounded-xl bg-[#0B0F19] hover:bg-slate-800 border border-[#1E293B] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Descartar dados locais</span>
        </button>
      </div>
    </div>
  );
};
