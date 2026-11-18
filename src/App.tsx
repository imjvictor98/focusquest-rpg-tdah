import React, { useEffect, useState, useCallback } from 'react';
import {
  AppState,
  BrainDumpItem,
  Difficulty,
  FloatingFeedback,
  RewardItem,
  ToastNotification,
} from './types';
import {
  applyPlayerRewards,
  BOSS_VICTORY_BONUS_COINS,
  BOSS_VICTORY_BONUS_XP,
  COMBO_TIMEOUT_MS,
  createInitialSeedState,
  createOnboardingBossQuest,
  loadAppState,
  ONBOARDING_BONUS_COINS,
  ONBOARDING_BONUS_XP,
  ONBOARDING_QUEST_ID,
  REWARD_TABLE,
  saveAppState,
  SUBTASK_BASE_COINS,
  SUBTASK_BASE_XP,
} from './utils/gameRules';
import { soundEngine } from './utils/soundEngine';
import {
  triggerBossDefeatConfetti,
  triggerLevelUpConfetti,
  triggerSmallBurst,
} from './utils/confettiFx';
import { PlayerHeader } from './components/PlayerHeader';
import { QuestBoard } from './components/QuestBoard';
import { BrainDumpPanel } from './components/BrainDumpPanel';
import { RewardShopPanel } from './components/RewardShopPanel';
import { TunnelModeOverlay } from './components/TunnelModeOverlay';
import { FeedbackLayer } from './components/FeedbackLayer';
import { OnboardingTour } from './components/OnboardingTour';
import { Sword, Brain, ShoppingBag } from 'lucide-react';

export function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [floatingItems, setFloatingItems] = useState<FloatingFeedback[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [levelUpModal, setLevelUpModal] = useState<{ level: number } | null>(null);
  const [mobileSection, setMobileSection] = useState<'quests' | 'brain' | 'shop'>('quests');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(
    () => !loadAppState().hasCompletedOnboarding
  );
  const [onboardingStep, setOnboardingStep] = useState<number>(0);
  const [onboardingActionDone, setOnboardingActionDone] = useState<boolean>(false);

  // Persist state on every update
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // Silent combo expiration check (Zero punishment)
  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev) => {
        if (
          prev.player.comboCount > 0 &&
          prev.player.lastActionTimestamp &&
          Date.now() - prev.player.lastActionTimestamp > COMBO_TIMEOUT_MS
        ) {
          return {
            ...prev,
            player: {
              ...prev.player,
              comboCount: 0,
              comboMultiplier: 1.0,
            },
          };
        }
        return prev;
      });
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // ESC key exits Tunnel Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.activeTunnelTask) {
        setState((prev) => ({ ...prev, activeTunnelTask: null }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activeTunnelTask]);

  const spawnFloatingText = useCallback(
    (
      e: React.MouseEvent | { clientX: number; clientY: number },
      xpText: string,
      coinText?: string,
      damageText?: string
    ) => {
      const x = e.clientX || window.innerWidth / 2;
      const y = e.clientY || window.innerHeight / 2;
      const id = `float-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setFloatingItems((prev) => [...prev, { id, x, y, xpText, coinText, damageText }]);
      setTimeout(() => {
        setFloatingItems((prev) => prev.filter((item) => item.id !== id));
      }, 1300);
    },
    []
  );

  const pushToast = useCallback(
    (title: string, subtitle: string, type: ToastNotification['type'] = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, subtitle, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  // Add new Quest
  const handleAddQuest = (title: string, difficulty: Difficulty, subtaskTitles: string[]) => {
    const newQuestId = `quest-${Date.now()}`;
    const newQuest = {
      id: newQuestId,
      title,
      difficulty,
      completed: false,
      createdAt: Date.now(),
      subtasks:
        difficulty === 'boss'
          ? subtaskTitles.map((st, idx) => ({
              id: `sub-${Date.now()}-${idx}`,
              title: st,
              completed: false,
              xpReward: SUBTASK_BASE_XP,
              coinReward: SUBTASK_BASE_COINS,
            }))
          : [],
    };

    setState((prev) => ({
      ...prev,
      quests: [newQuest, ...prev.quests],
    }));
  };

  // Complete Quick or Medium Quest
  const handleCompleteQuest = (questId: string, event: React.MouseEvent) => {
    const targetQuest = state.quests.find((q) => q.id === questId);
    if (!targetQuest || targetQuest.completed) return;

    const baseReward = REWARD_TABLE[targetQuest.difficulty];
    const now = Date.now();
    const { updatedPlayer, earnedXp, earnedCoins, leveledUp, newLevel } = applyPlayerRewards(
      state.player,
      baseReward.xp,
      baseReward.coins,
      now,
      true
    );

    // Visual & Audio feedback
    const normX = (event.clientX || window.innerWidth / 2) / window.innerWidth;
    const normY = (event.clientY || window.innerHeight / 2) / window.innerHeight;
    triggerSmallBurst(normX, normY);
    soundEngine.playTaskComplete(updatedPlayer.comboCount, state.player.soundEnabled);

    spawnFloatingText(event, `+${earnedXp} XP`, `+${earnedCoins} 🪙`);

    if (updatedPlayer.comboCount === 5 && state.player.comboCount < 5) {
      pushToast(
        '🔥 MODO ON FIRE ATIVADO (3.0x)!',
        'Seu hiperfoco atingiu o multiplicador máximo de XP e Moedas!',
        'combo'
      );
    }

    if (leveledUp) {
      setTimeout(() => {
        soundEngine.playLevelUp(state.player.soundEnabled);
        triggerLevelUpConfetti();
        setLevelUpModal({ level: newLevel });
      }, 280);
    }

    setState((prev) => ({
      ...prev,
      player: updatedPlayer,
      quests: prev.quests.map((q) =>
        q.id === questId ? { ...q, completed: true, completedAt: now } : q
      ),
      activeTunnelTask:
        prev.activeTunnelTask?.questId === questId ? null : prev.activeTunnelTask,
    }));

    if (isOnboardingOpen) {
      setOnboardingActionDone(true);
    }
  };

  // Complete a Boss Subtask (Micro-step)
  const handleCompleteSubtask = (
    questId: string,
    subtaskId: string,
    event: React.MouseEvent
  ) => {
    const targetQuest = state.quests.find((q) => q.id === questId);
    if (!targetQuest || targetQuest.completed) return;

    const targetSub = targetQuest.subtasks.find((s) => s.id === subtaskId);
    if (!targetSub || targetSub.completed) return;

    if (isOnboardingOpen) {
      setOnboardingActionDone(true);
    }

    const remainingBefore = targetQuest.subtasks.filter((s) => !s.completed);
    const isFinalSubtask = remainingBefore.length === 1 && remainingBefore[0].id === subtaskId;
    const hpDamagePercent = Math.round(100 / Math.max(1, targetQuest.subtasks.length));

    const totalBaseXp = isFinalSubtask
      ? SUBTASK_BASE_XP + BOSS_VICTORY_BONUS_XP
      : SUBTASK_BASE_XP;
    const totalBaseCoins = isFinalSubtask
      ? SUBTASK_BASE_COINS + BOSS_VICTORY_BONUS_COINS
      : SUBTASK_BASE_COINS;

    const now = Date.now();
    const { updatedPlayer, earnedXp, earnedCoins, leveledUp, newLevel } = applyPlayerRewards(
      state.player,
      totalBaseXp,
      totalBaseCoins,
      now,
      isFinalSubtask
    );

    if (isFinalSubtask) {
      soundEngine.playBossDefeat(state.player.soundEnabled);
      triggerBossDefeatConfetti();
      spawnFloatingText(
        event,
        `+${earnedXp} XP`,
        `+${earnedCoins} 🪙`,
        `💥 BOSS DERROTADO! (-${hpDamagePercent}% HP)`
      );
      pushToast(
        '🏆 BOSS DERROTADO!',
        `Você venceu "${targetQuest.title}" e ganhou o Bônus de Vitória!`,
        'boss'
      );
    } else {
      const normX = (event.clientX || window.innerWidth / 2) / window.innerWidth;
      const normY = (event.clientY || window.innerHeight / 2) / window.innerHeight;
      triggerSmallBurst(normX, normY);
      soundEngine.playBossHit(updatedPlayer.comboCount, state.player.soundEnabled);
      spawnFloatingText(
        event,
        `+${earnedXp} XP`,
        `+${earnedCoins} 🪙`,
        `-${hpDamagePercent}% HP`
      );
    }

    if (updatedPlayer.comboCount === 5 && state.player.comboCount < 5) {
      pushToast(
        '🔥 MODO ON FIRE ATIVADO (3.0x)!',
        'Cada micro-passo agora rende o triplo de XP e Moedas!',
        'combo'
      );
    }

    if (leveledUp) {
      setTimeout(() => {
        soundEngine.playLevelUp(state.player.soundEnabled);
        triggerLevelUpConfetti();
        setLevelUpModal({ level: newLevel });
      }, 380);
    }

    const updatedSubtasks = targetQuest.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: true } : s
    );
    const nextPendingSubtask = updatedSubtasks.find((s) => !s.completed);

    setState((prev) => {
      let nextTunnel = prev.activeTunnelTask;
      if (prev.activeTunnelTask?.questId === questId) {
        nextTunnel = nextPendingSubtask
          ? { questId, subtaskId: nextPendingSubtask.id }
          : null;
      }

      return {
        ...prev,
        player: updatedPlayer,
        quests: prev.quests.map((q) =>
          q.id === questId
            ? {
                ...q,
                subtasks: updatedSubtasks,
                completed: isFinalSubtask,
                completedAt: isFinalSubtask ? now : undefined,
              }
            : q
        ),
        activeTunnelTask: nextTunnel,
      };
    });
  };

  // Add another Subtask to an existing Boss
  const handleAddSubtaskToBoss = (questId: string, title: string) => {
    setState((prev) => ({
      ...prev,
      quests: prev.quests.map((q) =>
        q.id === questId
          ? {
              ...q,
              subtasks: [
                ...q.subtasks,
                {
                  id: `sub-${Date.now()}`,
                  title,
                  completed: false,
                  xpReward: SUBTASK_BASE_XP,
                  coinReward: SUBTASK_BASE_COINS,
                },
              ],
            }
          : q
      ),
    }));
  };

  const handleDeleteQuest = (questId: string) => {
    setState((prev) => ({
      ...prev,
      quests: prev.quests.filter((q) => q.id !== questId),
    }));
  };

  // Tunnel Mode Handlers
  const handleEnterTunnel = (questId: string, subtaskId?: string) => {
    const quest = state.quests.find((q) => q.id === questId);
    if (!quest) return;
    let resolvedSubtaskId = subtaskId;
    if (quest.difficulty === 'boss' && !resolvedSubtaskId) {
      resolvedSubtaskId = quest.subtasks.find((s) => !s.completed)?.id;
    }
    soundEngine.playTunnelEnter(state.player.soundEnabled);
    setState((prev) => ({
      ...prev,
      activeTunnelTask: { questId, subtaskId: resolvedSubtaskId },
    }));
  };

  // Brain Dump Handlers
  const handleAddBrainDump = (text: string) => {
    const newItem: BrainDumpItem = {
      id: `dump-${Date.now()}`,
      text,
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      brainDump: [newItem, ...prev.brainDump],
    }));
  };

  const handleConvertBrainDumpToQuest = (item: BrainDumpItem) => {
    const newQuest = {
      id: `quest-${Date.now()}`,
      title: item.text,
      difficulty: 'quick' as Difficulty,
      completed: false,
      createdAt: Date.now(),
      subtasks: [],
    };
    soundEngine.playTaskComplete(1, state.player.soundEnabled);
    pushToast(
      '⚡ Convertido em Missão!',
      `"${item.text}" agora está pronto no seu Quadro de Missões.`,
      'info'
    );
    setState((prev) => ({
      ...prev,
      quests: [newQuest, ...prev.quests],
      brainDump: prev.brainDump.filter((b) => b.id !== item.id),
    }));
  };

  const handleDiscardBrainDump = (id: string) => {
    setState((prev) => ({
      ...prev,
      brainDump: prev.brainDump.filter((b) => b.id !== id),
    }));
  };

  // Reward Shop Handlers
  const handleRedeemReward = (reward: RewardItem, event: React.MouseEvent) => {
    if (state.player.coins < reward.cost) return;

    soundEngine.playRewardRedeem(state.player.soundEnabled);
    const normX = (event.clientX || window.innerWidth / 2) / window.innerWidth;
    const normY = (event.clientY || window.innerHeight / 2) / window.innerHeight;
    triggerSmallBurst(normX, normY);
    spawnFloatingText(event, '🎉 Merecido!', `-${reward.cost} 🪙`);

    pushToast(
      `🎁 Recompensa Resgatada: ${reward.title}`,
      'Aproveite seu descanso 100% livre de culpa! Seu cérebro merece essa pausa.',
      'reward'
    );

    setState((prev) => ({
      ...prev,
      player: {
        ...prev.player,
        coins: prev.player.coins - reward.cost,
      },
      rewards: prev.rewards.map((r) =>
        r.id === reward.id ? { ...r, redeemedCount: r.redeemedCount + 1 } : r
      ),
    }));
  };

  const handleAddReward = (title: string, cost: number, icon: string) => {
    const newReward: RewardItem = {
      id: `reward-${Date.now()}`,
      title,
      cost,
      icon,
      redeemedCount: 0,
    };
    setState((prev) => ({
      ...prev,
      rewards: [...prev.rewards, newReward],
    }));
  };

  const handleDeleteReward = (id: string) => {
    setState((prev) => ({
      ...prev,
      rewards: prev.rewards.filter((r) => r.id !== id),
    }));
  };

  // Utility Handlers (Sound, Export, Import, Reset Seed)
  const handleToggleSound = () => {
    setState((prev) => ({
      ...prev,
      player: {
        ...prev.player,
        soundEnabled: !prev.player.soundEnabled,
      },
    }));
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focusquest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('💾 Backup Exportado', 'Arquivo JSON salvo com sucesso!', 'info');
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        if (parsed && parsed.player && Array.isArray(parsed.quests)) {
          setState(parsed);
          pushToast('✅ Progresso Restaurado!', 'Seu backup JSON foi carregado com sucesso.', 'info');
        }
      } catch {
        pushToast('Formato inválido', 'Escolha um arquivo JSON válido do FocusQuest.', 'info');
      }
    };
    reader.readAsText(file);
  };

  const handleResetSeed = () => {
    const freshSeed = createInitialSeedState();
    setState(freshSeed);
    setOnboardingStep(0);
    setOnboardingActionDone(false);
    setIsOnboardingOpen(true);
    pushToast(
      '✨ Estado Inicial Restaurado',
      'Quadro zerado com o Boss de Onboarding e Tutorial recarregados!',
      'info'
    );
  };

  // Onboarding Handlers
  const handleStartOnboarding = () => {
    setState((prev) => {
      const hasActiveQuests = prev.quests.some((q) => !q.completed);
      if (!hasActiveQuests) {
        return {
          ...prev,
          quests: [
            createOnboardingBossQuest(),
            ...prev.quests.filter((q) => q.id !== ONBOARDING_QUEST_ID),
          ],
        };
      }
      return prev;
    });
    setOnboardingStep(0);
    setOnboardingActionDone(false);
    setIsOnboardingOpen(true);
  };

  const handleSkipOnboarding = () => {
    setIsOnboardingOpen(false);
    setState((prev) => ({
      ...prev,
      hasCompletedOnboarding: true,
      quests: prev.quests.filter((q) => q.id !== ONBOARDING_QUEST_ID),
      activeTunnelTask:
        prev.activeTunnelTask?.questId === ONBOARDING_QUEST_ID
          ? null
          : prev.activeTunnelTask,
    }));
  };

  const handleFinishOnboarding = (event: React.MouseEvent) => {
    setIsOnboardingOpen(false);
    const alreadyRewarded = Boolean(state.hasCompletedOnboarding);

    if (!alreadyRewarded) {
      const now = Date.now();
      const { updatedPlayer, earnedXp, earnedCoins, leveledUp, newLevel } = applyPlayerRewards(
        state.player,
        ONBOARDING_BONUS_XP,
        ONBOARDING_BONUS_COINS,
        now,
        false
      );

      const normX = (event.clientX || window.innerWidth / 2) / window.innerWidth;
      const normY = (event.clientY || window.innerHeight / 2) / window.innerHeight;
      triggerSmallBurst(normX, normY);
      soundEngine.playRewardRedeem(state.player.soundEnabled);
      spawnFloatingText(event, `+${earnedXp} XP`, `+${earnedCoins} 🪙`, '🎁 Baú de Boas-Vindas!');

      pushToast(
        '🎉 Tutorial Concluído! Baú Resgatado!',
        `Você ganhou +${earnedXp} XP e +${earnedCoins} Moedas para começar sua jornada!`,
        'reward'
      );

      if (leveledUp) {
        setTimeout(() => {
          soundEngine.playLevelUp(state.player.soundEnabled);
          triggerLevelUpConfetti();
          setLevelUpModal({ level: newLevel });
        }, 300);
      }

      setState((prev) => ({
        ...prev,
        player: updatedPlayer,
        hasCompletedOnboarding: true,
      }));
    } else {
      pushToast(
        '✨ Tutorial Concluído!',
        'Boa aventura! Escolha sua próxima missão ou entre no Modo Túnel.',
        'info'
      );
    }
  };

  const handleTriggerDemoBossAttack = (event: React.MouseEvent) => {
    const activeBoss = state.quests.find(
      (q) => !q.completed && q.difficulty === 'boss' && q.subtasks.some((s) => !s.completed)
    );
    if (activeBoss) {
      const firstSub = activeBoss.subtasks.find((s) => !s.completed);
      if (firstSub) {
        handleCompleteSubtask(activeBoss.id, firstSub.id, event);
        return;
      }
    }

    const anyActive = state.quests.find((q) => !q.completed);
    if (anyActive) {
      handleCompleteQuest(anyActive.id, event);
      return;
    }

    // Fallback simulated dopamine hit if board is completely empty
    const normX = (event.clientX || window.innerWidth / 2) / window.innerWidth;
    const normY = (event.clientY || window.innerHeight / 2) / window.innerHeight;
    triggerSmallBurst(normX, normY);
    soundEngine.playBossHit(state.player.comboCount + 1, state.player.soundEnabled);
    spawnFloatingText(event, '+15 XP', '+5 🪙', '-33% HP');
    setOnboardingActionDone(true);
  };

  const handleTriggerDemoTunnel = () => {
    const targetQuest =
      state.quests.find((q) => !q.completed && q.difficulty === 'boss') ||
      state.quests.find((q) => !q.completed);
    if (targetQuest) {
      handleEnterTunnel(targetQuest.id);
    }
  };

  // Active Tunnel Quest Resolution
  const activeTunnelQuest = state.activeTunnelTask
    ? state.quests.find((q) => q.id === state.activeTunnelTask?.questId)
    : undefined;
  const activeTunnelSubtask =
    activeTunnelQuest && state.activeTunnelTask?.subtaskId
      ? activeTunnelQuest.subtasks.find((s) => s.id === state.activeTunnelTask?.subtaskId)
      : undefined;

  const hasActiveBoss = state.quests.some(
    (q) => !q.completed && q.difficulty === 'boss' && q.subtasks.some((s) => !s.completed)
  );
  const hasAnyActiveQuest = state.quests.some((q) => !q.completed);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 pb-16">
      {/* Ambient Subtle Top Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[220px] bg-violet-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Top Player Stats & Controls Header */}
        <PlayerHeader
          player={state.player}
          onToggleSound={handleToggleSound}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onResetSeed={handleResetSeed}
          onStartOnboarding={handleStartOnboarding}
        />

        {/* Mobile Quick Access Switcher */}
        <div className="grid grid-cols-3 gap-2 lg:hidden bg-[#131A2A] p-1.5 rounded-2xl border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setMobileSection('quests')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileSection === 'quests'
                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sword className="w-3.5 h-3.5" />
            <span>Missões ({state.quests.filter((q) => !q.completed).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('brain')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileSection === 'brain'
                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Brain Dump ({state.brainDump.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('shop')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileSection === 'shop'
                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Loja ({state.player.coins}🪙)</span>
          </button>
        </div>

        {/* Main 2-Column Desktop Grid (Quests Left, Brain Dump + Shop Right) */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Quests & Boss Battles */}
          <div
            className={`lg:col-span-7 ${
              mobileSection === 'quests' ? 'block' : 'hidden lg:block'
            }`}
          >
            <QuestBoard
              quests={state.quests}
              comboMultiplier={state.player.comboMultiplier}
              onAddQuest={handleAddQuest}
              onCompleteQuest={handleCompleteQuest}
              onCompleteSubtask={handleCompleteSubtask}
              onAddSubtaskToBoss={handleAddSubtaskToBoss}
              onDeleteQuest={handleDeleteQuest}
              onEnterTunnel={handleEnterTunnel}
            />
          </div>

          {/* Right Column: Brain Dump + Real-World Reward Shop */}
          <div className="lg:col-span-5 space-y-6">
            <div className={mobileSection === 'brain' ? 'block' : 'hidden lg:block'}>
              <BrainDumpPanel
                items={state.brainDump}
                onAdd={handleAddBrainDump}
                onConvertToQuest={handleConvertBrainDumpToQuest}
                onDiscard={handleDiscardBrainDump}
              />
            </div>

            <div className={mobileSection === 'shop' ? 'block' : 'hidden lg:block'}>
              <RewardShopPanel
                rewards={state.rewards}
                playerCoins={state.player.coins}
                onRedeem={handleRedeemReward}
                onAddReward={handleAddReward}
                onDeleteReward={handleDeleteReward}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Interactive Gamified Onboarding Tour (Hidden while inside fullscreen Tunnel Mode) */}
      <OnboardingTour
        isOpen={isOnboardingOpen && !activeTunnelQuest}
        stepIndex={onboardingStep}
        interactiveActionDone={onboardingActionDone}
        hasBossQuest={hasActiveBoss}
        hasAnyActiveQuest={hasAnyActiveQuest}
        onStepChange={setOnboardingStep}
        onSkip={handleSkipOnboarding}
        onFinish={handleFinishOnboarding}
        onTriggerDemoBossAttack={handleTriggerDemoBossAttack}
        onTriggerDemoTunnel={handleTriggerDemoTunnel}
        onSwitchMobileTab={setMobileSection}
      />

      {/* Fullscreen Tunnel Mode Overlay (Deep Hyperfocus) */}
      {activeTunnelQuest && (
        <TunnelModeOverlay
          quest={activeTunnelQuest}
          activeSubtask={activeTunnelSubtask}
          comboMultiplier={state.player.comboMultiplier}
          onCompleteCurrent={(e) => {
            if (activeTunnelSubtask) {
              handleCompleteSubtask(activeTunnelQuest.id, activeTunnelSubtask.id, e);
            } else {
              handleCompleteQuest(activeTunnelQuest.id, e);
            }
          }}
          onAddBrainDump={handleAddBrainDump}
          onExitTunnel={() => setState((prev) => ({ ...prev, activeTunnelTask: null }))}
        />
      )}

      {/* Floating Numbers, Celebration Toasts & Level Up Modal */}
      <FeedbackLayer
        floatingItems={floatingItems}
        toasts={toasts}
        levelUpModal={levelUpModal}
        onCloseLevelUp={() => setLevelUpModal(null)}
        onDismissToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
export default App;
