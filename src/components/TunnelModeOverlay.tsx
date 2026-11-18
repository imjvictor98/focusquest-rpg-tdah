import React, { useEffect, useState } from 'react';
import {
  Focus,
  CheckCircle2,
  X,
  Play,
  Pause,
  RotateCcw,
  Brain,
  Flame,
  Sparkles,
  Skull,
  ArrowRight,
} from 'lucide-react';
import { Quest, Subtask } from '../types';
import {
  calculateBossHpPercentage,
  REWARD_TABLE,
  SUBTASK_BASE_COINS,
  SUBTASK_BASE_XP,
} from '../utils/gameRules';

type TimerMode = 'free' | 'sprint15' | 'pomodoro25';

interface TunnelModeOverlayProps {
  quest: Quest;
  activeSubtask?: Subtask;
  comboMultiplier: number;
  onCompleteCurrent: (event: React.MouseEvent) => void;
  onAddBrainDump: (text: string) => void;
  onExitTunnel: () => void;
}

export const TunnelModeOverlay: React.FC<TunnelModeOverlayProps> = ({
  quest,
  activeSubtask,
  comboMultiplier,
  onCompleteCurrent,
  onAddBrainDump,
  onExitTunnel,
}) => {
  const [timerMode, setTimerMode] = useState<TimerMode>('free');
  const [seconds, setSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [intrusiveThought, setIntrusiveThought] = useState('');
  const [parkedNotice, setParkedNotice] = useState(false);

  const switchMode = (mode: TimerMode) => {
    setTimerMode(mode);
    setIsRunning(true);
    if (mode === 'free') setSeconds(0);
    if (mode === 'sprint15') setSeconds(15 * 60);
    if (mode === 'pomodoro25') setSeconds(25 * 60);
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (timerMode === 'free') return prev + 1;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, timerMode]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleParkThought = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intrusiveThought.trim()) return;
    onAddBrainDump(intrusiveThought.trim());
    setIntrusiveThought('');
    setParkedNotice(true);
    setTimeout(() => setParkedNotice(false), 2600);
  };

  const isBoss = quest.difficulty === 'boss';
  const bossHp = isBoss ? calculateBossHpPercentage(quest) : 100;
  const pendingSubtasks = quest.subtasks.filter((s) => !s.completed);
  const currentStepIndex = activeSubtask
    ? quest.subtasks.findIndex((s) => s.id === activeSubtask.id) + 1
    : 1;

  const baseXp = activeSubtask ? SUBTASK_BASE_XP : REWARD_TABLE[quest.difficulty].xp;
  const baseCoins = activeSubtask ? SUBTASK_BASE_COINS : REWARD_TABLE[quest.difficulty].coins;
  const rewardXp = Math.round(baseXp * comboMultiplier);
  const rewardCoins = Math.round(baseCoins * comboMultiplier);

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] text-white flex flex-col justify-between p-5 sm:p-8 overflow-y-auto">
      {/* Ambient Radial Focus Spotlight */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.12)_0%,transparent_65%)]" />

      {/* Top Bar */}
      <div className="relative z-10 max-w-3xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-violet-500 animate-ping" />
          <span className="text-xs font-extrabold uppercase tracking-widest text-violet-400 flex items-center gap-1.5">
            <Focus className="w-4 h-4" />
            MODO TÚNEL • HIPERFOCO PROFUNDO
          </span>
        </div>

        <button
          onClick={onExitTunnel}
          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <X className="w-4 h-4" />
          <span>Sair do Túnel (ESC)</span>
        </button>
      </div>

      {/* Center Focus Stage */}
      <div className="relative z-10 max-w-2xl w-full mx-auto my-auto py-8 text-center space-y-8">
        {/* Context Badge / Boss HP Mini Bar */}
        {isBoss && (
          <div className="max-w-md mx-auto bg-zinc-900/90 border border-red-500/30 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-red-400 flex items-center gap-1.5 truncate">
                <Skull className="w-4 h-4 shrink-0" />
                <span className="truncate">{quest.title}</span>
              </span>
              <span className="font-mono text-zinc-400 shrink-0">
                Passo {currentStepIndex} de {quest.subtasks.length} • {bossHp}% HP
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#EF4444] to-[#F97316] transition-all duration-500 ease-out"
                style={{ width: `${bossHp}%` }}
              />
            </div>
          </div>
        )}

        {/* Current Active Micro-Task Title */}
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Sua única missão agora ({comboMultiplier.toFixed(1)}x Combo)
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight px-2">
            {activeSubtask ? activeSubtask.title : quest.title}
          </h2>
          {activeSubtask && pendingSubtasks.length > 1 && (
            <p className="text-xs text-zinc-400 flex items-center justify-center gap-1">
              <ArrowRight className="w-3.5 h-3.5 text-violet-400" />
              Ao concluir, avançaremos automaticamente para o próximo micro-passo
            </p>
          )}
        </div>

        {/* Versatile 3-Mode Timer */}
        <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-3xl p-6 max-w-md mx-auto shadow-2xl space-y-4">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => switchMode('free')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                timerMode === 'free'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Livre (Crescente)
            </button>
            <button
              type="button"
              onClick={() => switchMode('sprint15')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                timerMode === 'sprint15'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sprint 15m
            </button>
            <button
              type="button"
              onClick={() => switchMode('pomodoro25')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                timerMode === 'pomodoro25'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Pomodoro 25m
            </button>
          </div>

          {/* Digital Clock Display */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-5xl sm:text-6xl font-extrabold font-mono tracking-wider text-white">
              {formatTime(seconds)}
            </span>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsRunning(!isRunning)}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition-colors"
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? 'Pausar' : 'Retomar'}</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode(timerMode)}
              className="px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zerar</span>
            </button>
          </div>
        </div>

        {/* GIANT Tactile "CONCLUIR AGORA" Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={(e) => onCompleteCurrent(e)}
            className="w-full max-w-md mx-auto py-5 px-8 rounded-2xl bg-gradient-to-r from-[#10B981] to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-black text-lg sm:text-xl tracking-wide shadow-[0_0_40px_rgba(16,185,129,0.35)] hover:shadow-[0_0_55px_rgba(16,185,129,0.55)] flex flex-col items-center justify-center gap-1 transition-all transform hover:-translate-y-0.5 active:scale-95"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              <span>CONCLUIR AGORA</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-950/90">
              Recompensa imediata: +{rewardXp} XP · +{rewardCoins} Moedas
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Mini Brain Dump ("Estacionar pensamento intrusivo") */}
      <div className="relative z-10 max-w-xl w-full mx-auto pt-4">
        <form
          onSubmit={handleParkThought}
          className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 flex flex-col sm:flex-row items-center gap-2.5"
        >
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <Brain className="w-4 h-4 text-violet-400 shrink-0 ml-1" />
            <input
              type="text"
              value={intrusiveThought}
              onChange={(e) => setIntrusiveThought(e.target.value)}
              placeholder="Estacionar pensamento intrusivo em 3s (Ex: Lembrar de comprar café)..."
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!intrusiveThought.trim()}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-bold text-violet-300 disabled:opacity-40 shrink-0 transition-colors"
          >
            Estacionar Ideia
          </button>
        </form>

        {parkedNotice && (
          <div className="mt-2 text-center text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pensamento salvo no Brain Dump! Sua mente está livre para continuar no foco.</span>
          </div>
        )}
      </div>
    </div>
  );
};
