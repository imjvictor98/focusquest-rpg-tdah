import React, { useRef } from 'react';
import {
  Flame,
  Coins,
  Sparkles,
  Volume2,
  VolumeX,
  Download,
  Upload,
  RotateCcw,
  Shield,
  Zap,
  HelpCircle,
  Fingerprint,
  Cloud,
  CloudOff,
  Loader2,
  LogOut,
} from 'lucide-react';
import { AuthUser, PlayerState, SyncStatus } from '../types';

interface PlayerHeaderProps {
  player: PlayerState;
  user: AuthUser;
  syncStatus: SyncStatus;
  onRetrySync: () => void;
  onOpenSecurityModal: () => void;
  onLogout: () => void;
  onToggleSound: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onResetSeed: () => void;
  onStartOnboarding: () => void;
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({
  player,
  user,
  syncStatus,
  onRetrySync,
  onOpenSecurityModal,
  onLogout,
  onToggleSound,
  onExportJson,
  onImportJson,
  onResetSeed,
  onStartOnboarding,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xpPercentage = Math.min(
    100,
    Math.max(0, Math.round((player.currentXp / player.xpToNextLevel) * 100))
  );
  const isOnFire = player.comboMultiplier >= 3.0 || player.comboCount >= 5;
  const isComboActive = player.comboCount >= 2;

  const getHeroTitle = (level: number) => {
    if (level < 3) return 'Explorador do Foco';
    if (level < 5) return 'Domador de Dopamina';
    if (level < 8) return 'Cavaleiro do Hiperfoco';
    if (level < 12) return 'Caçador de Bosses';
    return 'Lenda Neurodivergente';
  };

  return (
    <header
      data-onboarding-id="player-header"
      className="bg-[#131A2A]/95 backdrop-blur-md border border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-xl"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Avatar / Level & XP Bar */}
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] p-0.5 shadow-lg shadow-violet-500/25">
                <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-violet-400">
                    LVL
                  </span>
                  <span className="text-xl font-extrabold font-mono text-white leading-none">
                    {player.level}
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400">
                <Shield className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  FocusQuest{' '}
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    RPG
                  </span>
                </h1>
                {syncStatus === 'saving' && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30"
                    title="Salvando progresso no banco Neon PostgreSQL"
                  >
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Salvando...
                  </span>
                )}
                {syncStatus === 'synced' && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    title="Seu progresso está salvo com segurança na nuvem"
                  >
                    <Cloud className="w-3 h-3" />
                    Nuvem
                  </span>
                )}
                {syncStatus === 'error' && (
                  <button
                    type="button"
                    onClick={onRetrySync}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors"
                    title="Falha ao salvar no banco — clique para tentar novamente"
                  >
                    <CloudOff className="w-3 h-3" />
                    Reenviar
                  </button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium flex flex-wrap items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-slate-200 font-semibold">{user.displayName}</span>
                <span className="text-slate-600">•</span>
                <span>{getHeroTitle(player.level)}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">{player.totalQuestsCompleted} missões vencidas</span>
              </p>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="flex-1 max-w-md sm:ml-2">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-violet-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-violet-400" />
                Experiência (XP)
              </span>
              <span className="font-mono text-slate-300">
                <strong className="text-white">{player.currentXp}</strong> / {player.xpToNextLevel} XP{' '}
                <span className="text-violet-400">({xpPercentage}%)</span>
              </span>
            </div>
            <div className="w-full h-3.5 bg-[#0B0F19] rounded-full overflow-hidden border border-[#1E293B] p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#6366F1] transition-all duration-500 ease-out relative"
                style={{ width: `${Math.max(4, xpPercentage)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Combo Card, Coins & Utility Controls */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3">
          {/* Combo Multiplier Card */}
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all duration-300 ${
              isOnFire
                ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border-amber-400 animate-pulse-glow'
                : isComboActive
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-[#0B0F19]/80 border-[#1E293B]'
            }`}
            title="Conclua ações dentro de 30 minutos para subir o multiplicador de dopamina até 3.0x!"
          >
            <div
              className={`p-1.5 rounded-lg ${
                isOnFire
                  ? 'bg-amber-500 text-slate-950'
                  : isComboActive
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Flame className={`w-4 h-4 ${isOnFire ? 'animate-bounce' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isOnFire ? 'ON FIRE!' : 'Combo'}
                </span>
                {player.comboCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    {player.comboCount}x hits
                  </span>
                )}
              </div>
              <div className="text-sm font-extrabold font-mono text-amber-400 leading-tight">
                {player.comboMultiplier.toFixed(1)}x{' '}
                <span className="text-[11px] font-normal text-slate-400">XP/Moedas</span>
              </div>
            </div>
          </div>

          {/* Coins Wallet */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0B0F19]/90 border border-amber-500/30 shadow-inner">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tesouro
              </span>
              <span className="text-sm font-extrabold font-mono text-amber-400">
                {player.coins} <span className="text-xs font-normal text-amber-300/80">moedas</span>
              </span>
            </div>
          </div>

          {/* Quick Utility Buttons (Passkeys/Conta, Tutorial, Audio + Backup JSON + Logout) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={onOpenSecurityModal}
              className={`relative px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                user.passkeysCount > 0
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/35 text-emerald-300 hover:text-white'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-200 hover:text-white'
              }`}
              title="Gerenciar Passkeys, senha de recuperação e perfil"
              aria-label="Configurar Passkeys e Conta"
            >
              <Fingerprint className="w-4 h-4" />
              <span className="hidden sm:inline">
                {user.passkeysCount > 0 ? `Passkeys (${user.passkeysCount})` : 'Configurar Passkey'}
              </span>
              {user.passkeysCount === 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={onStartOnboarding}
              className="px-3 py-2.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/40 text-violet-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              title="Abrir Tour Interativo de Como Jogar"
              aria-label="Como Jogar"
            >
              <HelpCircle className="w-4 h-4 text-violet-400" />
              <span className="hidden sm:inline">Tutorial</span>
            </button>

            <button
              onClick={onToggleSound}
              className={`p-2.5 rounded-xl border transition-colors ${
                player.soundEnabled
                  ? 'bg-[#0B0F19] border-[#1E293B] text-violet-400 hover:border-violet-500/50'
                  : 'bg-[#0B0F19] border-[#1E293B] text-slate-500 hover:text-slate-300'
              }`}
              title={player.soundEnabled ? 'Som Sintetizado Ativo (Clique para mutar)' : 'Som Mutado'}
              aria-label="Alternar som"
            >
              {player.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onExportJson}
              className="p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
              title="Exportar progresso (Backup JSON)"
              aria-label="Exportar JSON"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
              title="Importar progresso (JSON)"
              aria-label="Importar JSON"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportJson(file);
                  e.target.value = '';
                }
              }}
            />

            <button
              onClick={onResetSeed}
              className="p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
              title="Restaurar Missões de Exemplo (Onboarding Seed)"
              aria-label="Restaurar estado inicial"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              className="p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
              title="Sair da conta"
              aria-label="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
