import React, { useEffect, useState, useCallback } from 'react';
import {
  Sparkles,
  Sword,
  Skull,
  Focus,
  Brain,
  ShoppingBag,
  Flame,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Zap,
  Trophy,
  MousePointerClick,
} from 'lucide-react';
import { ONBOARDING_BONUS_COINS, ONBOARDING_BONUS_XP } from '../utils/gameRules';

export interface OnboardingTourProps {
  isOpen: boolean;
  stepIndex: number;
  interactiveActionDone: boolean;
  hasBossQuest: boolean;
  hasAnyActiveQuest: boolean;
  onStepChange: (nextStep: number) => void;
  onSkip: () => void;
  onFinish: (event: React.MouseEvent) => void;
  onTriggerDemoBossAttack: (event: React.MouseEvent) => void;
  onTriggerDemoTunnel: () => void;
  onSwitchMobileTab: (tab: 'quests' | 'brain' | 'shop') => void;
}

interface StepConfig {
  id: string;
  badge: string;
  title: string;
  description: string;
  tip: string;
  targetId: string | null;
  fallbackTargetId?: string;
  mobileTab?: 'quests' | 'brain' | 'shop';
  icon: React.ReactNode;
  accentColor: 'violet' | 'amber' | 'red' | 'emerald';
  interactivePrompt?: string;
}

const STEPS: StepConfig[] = [
  {
    id: 'welcome',
    badge: 'BEM-VINDO AO FOCUSQUEST RPG',
    title: 'Transforme seu Foco em uma Aventura Sem Culpa',
    description:
      'O FocusQuest foi desenhado especialmente para mentes neurodivergentes e com TDAH. Aqui não existem punições por atrasos — apenas dopamina imediata, micro-passos anti-paralisia e recompensas reais.',
    tip: 'Complete este tour rápido de 1 minuto para ganhar seu Baú de Boas-Vindas (+30 XP e +20 Moedas)!',
    targetId: null,
    icon: <Sparkles className="w-6 h-6 text-violet-300" />,
    accentColor: 'violet',
  },
  {
    id: 'header',
    badge: 'PASSO 1 DE 6 • STATUS & DOPAMINA',
    title: 'Barra de XP, Combo On Fire & Tesouro',
    description:
      'No topo ficam seu Nível, seu XP e suas Moedas. Ao concluir tarefas em sequência (dentro de 30 min), seu Multiplicador de Combo sobe de 1.0x até 3.0x (MODO ON FIRE 🔥), triplicando seus ganhos!',
    tip: 'Se você fizer uma pausa longa, o combo apenas volta para 1.0x silenciosamente. Zero perda de XP ou moedas!',
    targetId: 'player-header',
    icon: <Flame className="w-5 h-5 text-amber-400" />,
    accentColor: 'amber',
  },
  {
    id: 'creator',
    badge: 'PASSO 2 DE 6 • QUADRO DE MISSÕES',
    title: 'Crie Missões Rápidas, Médias ou Chefões (Boss)',
    description:
      'Adicione tarefas escolhendo o tamanho do desafio: Rápida (Regra dos 2 minutos), Média ou Boss. Quando uma tarefa parecer grande ou assustadora, escolha "Boss" e use a varinha mágica para quebrá-la em 3 micro-passos!',
    tip: 'Quebrar uma tarefa complexa em micro-passos ridiculamente pequenos é o segredo nº 1 para vencer a paralisia executiva.',
    targetId: 'quest-creator',
    mobileTab: 'quests',
    icon: <Sword className="w-5 h-5 text-violet-400" />,
    accentColor: 'violet',
  },
  {
    id: 'boss-practice',
    badge: 'PASSO 3 DE 6 • PRÁTICA INTERATIVA',
    title: 'Cause Dano ao Boss Agora Mesmo!',
    description:
      'Tarefas complexas viram Chefões com barra de HP vermelha. Cada micro-passo concluído drena o HP do Boss, solta confetes e gera XP + Moedas na hora!',
    tip: 'Experimente agora: clique em um micro-passo do Boss destacado (ou no botão abaixo) para testar seu primeiro ataque!',
    targetId: 'boss-quest-card',
    fallbackTargetId: 'active-quests',
    mobileTab: 'quests',
    icon: <Skull className="w-5 h-5 text-red-400" />,
    accentColor: 'red',
    interactivePrompt: 'Clique em "Atacar" em um micro-passo do Boss ou use o botão de teste abaixo!',
  },
  {
    id: 'tunnel',
    badge: 'PASSO 4 DE 6 • HIPERFOCO PROFUNDO',
    title: 'Modo Túnel: Uma Única Coisa na Tela',
    description:
      'Sentiu sobrecarga visual com várias tarefas? O botão "Modo Túnel" esconde todo o resto da tela e isola apenas o micro-passo atual, com cronômetro flexível (Livre, Sprint 15m ou Pomodoro 25m).',
    tip: 'Dentro do Modo Túnel, se surgir uma distração, você pode estacioná-la em 3 segundos sem sair do foco!',
    targetId: 'active-quests',
    mobileTab: 'quests',
    icon: <Focus className="w-5 h-5 text-violet-400" />,
    accentColor: 'violet',
  },
  {
    id: 'brain-dump',
    badge: 'PASSO 5 DE 6 • MENTE LIVRE',
    title: 'Bloco de Despejo (Brain Dump)',
    description:
      'Lembrou de algo aleatório no meio de outra tarefa? Anote aqui em 3 segundos para não esquecer e não interromper o que estava fazendo. Depois, converta em Missão com 1 clique!',
    tip: 'Tirar pendências da memória de trabalho reduz a ansiedade e libera energia mental.',
    targetId: 'brain-dump',
    mobileTab: 'brain',
    icon: <Brain className="w-5 h-5 text-violet-400" />,
    accentColor: 'violet',
  },
  {
    id: 'reward-shop',
    badge: 'PASSO 6 DE 6 • DESCANSO SEM CULPA',
    title: 'Loja de Recompensas do Mundo Real',
    description:
      'Use as moedas conquistadas nas missões para "comprar" pausas reais: 15 min de redes sociais, café especial, episódio de série ou videogame — 100% livre de culpa!',
    tip: 'Você também pode cadastrar suas próprias recompensas personalizadas clicando em "+ Nova".',
    targetId: 'reward-shop',
    mobileTab: 'shop',
    icon: <ShoppingBag className="w-5 h-5 text-amber-400" />,
    accentColor: 'amber',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  stepIndex,
  interactiveActionDone,
  hasBossQuest,
  hasAnyActiveQuest,
  onStepChange,
  onSkip,
  onFinish,
  onTriggerDemoBossAttack,
  onTriggerDemoTunnel,
  onSwitchMobileTab,
}) => {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const currentStep = STEPS[Math.min(Math.max(0, stepIndex), STEPS.length - 1)];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const updateSpotlight = useCallback(() => {
    if (!isOpen || !currentStep.targetId) {
      setRect(null);
      return;
    }

    let el = document.querySelector(
      `[data-onboarding-id="${currentStep.targetId}"]`
    ) as HTMLElement | null;

    if ((!el || el.offsetParent === null) && currentStep.fallbackTargetId) {
      el = document.querySelector(
        `[data-onboarding-id="${currentStep.fallbackTargetId}"]`
      ) as HTMLElement | null;
    }

    if (!el || el.offsetParent === null) {
      setRect(null);
      return;
    }

    const r = el.getBoundingClientRect();
    const pad = 8;
    setRect({
      top: Math.max(4, r.top - pad),
      left: Math.max(4, r.left - pad),
      width: Math.min(window.innerWidth - 8, r.width + pad * 2),
      height: r.height + pad * 2,
    });
  }, [isOpen, currentStep]);

  // Switch mobile tab when step changes and scroll target into view
  useEffect(() => {
    if (!isOpen) return;

    if (currentStep.mobileTab) {
      onSwitchMobileTab(currentStep.mobileTab);
    }

    const timer = setTimeout(() => {
      if (!currentStep.targetId) {
        setRect(null);
        return;
      }

      let el = document.querySelector(
        `[data-onboarding-id="${currentStep.targetId}"]`
      ) as HTMLElement | null;

      if ((!el || el.offsetParent === null) && currentStep.fallbackTargetId) {
        el = document.querySelector(
          `[data-onboarding-id="${currentStep.fallbackTargetId}"]`
        ) as HTMLElement | null;
      }

      if (el && el.offsetParent !== null) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      updateSpotlight();
    }, 120);

    const settleTimer = setTimeout(updateSpotlight, 480);

    return () => {
      clearTimeout(timer);
      clearTimeout(settleTimer);
    };
  }, [isOpen, stepIndex, currentStep, onSwitchMobileTab, updateSpotlight]);

  // Update spotlight on scroll or resize
  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => updateSpotlight();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, updateSpotlight]);

  if (!isOpen) return null;

  // Decide card position so it never blocks the highlighted target
  const isTargetInBottomHalf =
    rect !== null && rect.top + rect.height / 2 > window.innerHeight * 0.52;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Backdrop or Spotlight Cutout */}
      {rect ? (
        <div
          style={{
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            boxShadow: '0 0 0 9999px rgba(7, 10, 19, 0.80)',
          }}
          className="fixed rounded-2xl border-2 border-violet-400 transition-all duration-300 ease-out pointer-events-none"
        >
          {/* Animated pulse halo around the target */}
          <div className="absolute -inset-1.5 rounded-3xl border border-violet-400/50 animate-pulse pointer-events-none" />
        </div>
      ) : (
        <div className="fixed inset-0 bg-[#070A13]/85 backdrop-blur-sm pointer-events-auto transition-opacity" />
      )}

      {/* Interactive Guide Card */}
      <div
        className={`fixed inset-x-0 px-4 flex justify-center pointer-events-none transition-all duration-300 ${
          !rect
            ? 'top-1/2 -translate-y-1/2'
            : isTargetInBottomHalf
            ? 'top-4 sm:top-6'
            : 'bottom-4 sm:bottom-6'
        }`}
      >
        <div className="pointer-events-auto w-full max-w-xl bg-[#131A2A]/95 backdrop-blur-xl border-2 border-violet-500/70 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(139,92,246,0.35)] space-y-4 relative overflow-hidden">
          {/* Ambient glow inside modal */}
          <div className="absolute -top-16 -right-16 w-44 h-44 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar: Step Badge + Progress Dots + Skip */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                currentStep.accentColor === 'red'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : currentStep.accentColor === 'amber'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-violet-500/20 text-violet-300 border-violet-500/40'
              }`}
            >
              {currentStep.icon}
              <span>{currentStep.badge}</span>
            </span>

            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800/70 flex items-center gap-1 transition-colors"
              title="Fechar tutorial (você pode abrir novamente no topo)"
            >
              <span>Pular</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Content */}
          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Welcome Overview Mini-Cards on First Step */}
          {isFirstStep && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-[#0B0F19]/90 border border-[#1E293B] rounded-xl p-2.5 text-center space-y-1">
                <Skull className="w-4 h-4 text-red-400 mx-auto" />
                <p className="text-[11px] font-bold text-white">Quebre Bosses</p>
                <p className="text-[10px] text-slate-400">Micro-passos fáceis</p>
              </div>
              <div className="bg-[#0B0F19]/90 border border-[#1E293B] rounded-xl p-2.5 text-center space-y-1">
                <Focus className="w-4 h-4 text-violet-400 mx-auto" />
                <p className="text-[11px] font-bold text-white">Modo Túnel</p>
                <p className="text-[10px] text-slate-400">Zero distração visual</p>
              </div>
              <div className="bg-[#0B0F19]/90 border border-[#1E293B] rounded-xl p-2.5 text-center space-y-1">
                <ShoppingBag className="w-4 h-4 text-amber-400 mx-auto" />
                <p className="text-[11px] font-bold text-white">Loja Real</p>
                <p className="text-[10px] text-slate-400">Descanso sem culpa</p>
              </div>
            </div>
          )}

          {/* Interactive Action Callout for Step 3 (Boss Attack) */}
          {currentStep.id === 'boss-practice' && (
            <div
              className={`rounded-2xl p-3.5 border transition-all ${
                interactiveActionDone
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                  : 'bg-red-500/10 border-red-500/40 text-red-200'
              }`}
            >
              {interactiveActionDone ? (
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <strong className="text-emerald-300 block">
                      Golpe Crítico! Você drenou o HP do Boss e ganhou XP + Moedas!
                    </strong>
                    <span>Viu como um micro-passo gera dopamina imediata?</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <MousePointerClick className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />
                    <span>
                      <strong>Desafio Prático:</strong> Clique em{' '}
                      <span className="text-emerald-300 font-bold">Atacar</span> no card do Boss ou
                      teste aqui:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onTriggerDemoBossAttack}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-xs shrink-0 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    ⚔️ Simular Ataque (+XP)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Interactive Action Callout for Step 4 (Tunnel Mode Preview) */}
          {currentStep.id === 'tunnel' && hasAnyActiveQuest && (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs text-violet-200">
                Quer espiar como o <strong>Modo Túnel</strong> isola sua mente?
              </span>
              <button
                type="button"
                onClick={onTriggerDemoTunnel}
                className="px-3 py-1.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-400/50 text-violet-200 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-95"
              >
                <Focus className="w-3.5 h-3.5 text-violet-300" />
                <span>Testar Modo Túnel Agora</span>
              </button>
            </div>
          )}

          {/* Neurodivergent Pro-Tip Box */}
          <div className="bg-[#0B0F19]/90 border border-[#1E293B] rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">{currentStep.tip}</p>
          </div>

          {/* Footer: Progress Dots + Back / Next / Claim Bonus Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Step Progress Dots */}
            <div className="flex items-center justify-center sm:justify-start gap-1.5">
              {STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onStepChange(idx)}
                  aria-label={`Ir para passo ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === stepIndex
                      ? 'w-7 bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]'
                      : idx < stepIndex
                      ? 'w-2 bg-violet-400/60 hover:bg-violet-400'
                      : 'w-2 bg-slate-700 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-end gap-2">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={() => onStepChange(stepIndex - 1)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#0B0F19] hover:bg-slate-800 border border-[#1E293B] text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              )}

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => onStepChange(stepIndex + 1)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-violet-600/30 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <span>{isFirstStep ? 'Começar Tour Guiado' : 'Próximo Passo'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onFinish}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-400 to-amber-400 hover:from-amber-400 hover:to-orange-300 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Trophy className="w-4 h-4" />
                  <span>
                    Concluir & Resgatar (+{ONBOARDING_BONUS_XP} XP / +{ONBOARDING_BONUS_COINS} 🪙)
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
