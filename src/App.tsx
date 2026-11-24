import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  AppState,
  AuthUser,
  BrainDumpItem,
  Difficulty,
  FloatingFeedback,
  RewardItem,
  SyncStatus,
  ToastNotification,
} from './types';
import {
  applyPlayerRewards,
  BOSS_VICTORY_BONUS_COINS,
  BOSS_VICTORY_BONUS_XP,
  clearLegacyLocalState,
  COMBO_TIMEOUT_MS,
  createInitialSeedState,
  createOnboardingBossQuest,
  normalizeAppState,
  ONBOARDING_BONUS_COINS,
  ONBOARDING_BONUS_XP,
  ONBOARDING_QUEST_ID,
  readLegacyLocalState,
  REWARD_TABLE,
  SUBTASK_BASE_COINS,
  SUBTASK_BASE_XP,
} from './utils/gameRules';
import { soundEngine } from './utils/soundEngine';
import {
  triggerBossDefeatConfetti,
  triggerLevelUpConfetti,
  triggerSmallBurst,
} from './utils/confettiFx';
import {
  ApiError,
  fetchCurrentUser,
  loadCloudGameState,
  logoutAccount,
  saveCloudGameState,
} from './services/api';
import { PlayerHeader } from './components/PlayerHeader';
import { QuestBoard } from './components/QuestBoard';
import { BrainDumpPanel } from './components/BrainDumpPanel';
import { RewardShopPanel } from './components/RewardShopPanel';
import { TunnelModeOverlay } from './components/TunnelModeOverlay';
import { FeedbackLayer } from './components/FeedbackLayer';
import { OnboardingTour } from './components/OnboardingTour';
import { AuthPage } from './components/AuthPage';
import { AccountSecurityModal } from './components/AccountSecurityModal';
import { LocalMigrationBanner } from './components/LocalMigrationBanner';
import { Sword, Brain, ShoppingBag, Fingerprint, Loader2, X } from 'lucide-react';

export function App() {
  // Authentication & Cloud State lifecycle
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [stateLoading, setStateLoading] = useState<boolean>(false);
  const [stateLoadedForUserId, setStateLoadedForUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  // Legacy localStorage migration state (read-only check, cleared after migration/dismiss)
  const [legacyLocalState, setLegacyLocalState] = useState<AppState | null>(() =>
    readLegacyLocalState()
  );
  const [migratingLegacy, setMigratingLegacy] = useState<boolean>(false);

  // Account & Passkey configuration modal
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [dismissedPasskeyPrompt, setDismissedPasskeyPrompt] = useState<boolean>(false);

  // Game State (stored in Neon PostgreSQL, never written to localStorage)
  const [state, setState] = useState<AppState>(() => createInitialSeedState());
  const [floatingItems, setFloatingItems] = useState<FloatingFeedback[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [levelUpModal, setLevelUpModal] = useState<{ level: number } | null>(null);
  const [mobileSection, setMobileSection] = useState<'quests' | 'brain' | 'shop'>('quests');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(0);
  const [onboardingActionDone, setOnboardingActionDone] = useState<boolean>(false);

  // Refs for debounced cloud persistence & flushing
  const isHydratingRef = useRef<boolean>(false);
  const hasDirtyStateRef = useRef<boolean>(false);
  const latestStateRef = useRef<AppState>(state);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

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

  // Check active session on mount
  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((user) => {
        if (!active) return;
        setAuthUser(user);
      })
      .catch(() => {
        if (!active) return;
        setAuthUser(null);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load user's cloud game state from PostgreSQL after authentication
  useEffect(() => {
    if (!authUser) {
      setStateLoadedForUserId(null);
      setIsOnboardingOpen(false);
      return;
    }

    if (stateLoadedForUserId === authUser.id) return;

    let active = true;
    setStateLoading(true);
    isHydratingRef.current = true;
    hasDirtyStateRef.current = false;

    loadCloudGameState()
      .then(({ state: cloudState }) => {
        if (!active) return;
        const normalized = normalizeAppState(cloudState);
        setState(normalized);
        latestStateRef.current = normalized;
        setIsOnboardingOpen(!normalized.hasCompletedOnboarding);
        setStateLoadedForUserId(authUser.id);
        setSyncStatus('synced');
        setLegacyLocalState(readLegacyLocalState());
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          setAuthUser(null);
          return;
        }
        setSyncStatus('error');
        pushToast(
          'Erro ao carregar dados',
          'Não foi possível sincronizar seu progresso do banco de dados.',
          'info'
        );
      })
      .finally(() => {
        if (active) {
          setStateLoading(false);
          // Allow persistence effect to observe subsequent user edits
          setTimeout(() => {
            isHydratingRef.current = false;
          }, 0);
        }
      });

    return () => {
      active = false;
    };
  }, [authUser, stateLoadedForUserId, pushToast]);

  const flushCloudSave = useCallback(
    async (keepalive = false) => {
      if (!authUser || stateLoadedForUserId !== authUser.id) return;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      hasDirtyStateRef.current = false;
      setSyncStatus('saving');
      try {
        await saveCloudGameState(latestStateRef.current, keepalive);
        setSyncStatus('synced');
      } catch (err) {
        hasDirtyStateRef.current = true;
        if (err instanceof ApiError && err.status === 401) {
          setAuthUser(null);
          return;
        }
        setSyncStatus('error');
      }
    },
    [authUser, stateLoadedForUserId]
  );

  // Debounced auto-save to Neon PostgreSQL whenever game state changes
  useEffect(() => {
    if (!authUser || stateLoadedForUserId !== authUser.id || isHydratingRef.current) {
      return;
    }

    hasDirtyStateRef.current = true;
    setSyncStatus('saving');

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      flushCloudSave(false);
    }, 450);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [state, authUser, stateLoadedForUserId, flushCloudSave]);

  // Flush pending changes when tab hides or page closes
  useEffect(() => {
    const handleFlush = () => {
      if (hasDirtyStateRef.current && authUser && stateLoadedForUserId === authUser.id) {
        void saveCloudGameState(latestStateRef.current, true);
        hasDirtyStateRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFlush();
      }
    };

    window.addEventListener('pagehide', handleFlush);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authUser, stateLoadedForUserId]);

  // Silent combo expiration check (Zero punishment)
  useEffect(() => {
    if (!authUser) return;
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
  }, [authUser]);

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

  // Auth Handlers
  const handleAuthenticated = (user: AuthUser, justRegisteredWithPassword = false) => {
    setAuthUser(user);
    setDismissedPasskeyPrompt(false);
    if (justRegisteredWithPassword && user.passkeysCount === 0) {
      setIsSecurityModalOpen(true);
    }
  };

  const handleLogout = async () => {
    if (hasDirtyStateRef.current) {
      await flushCloudSave(false);
    }
    try {
      await logoutAccount();
    } catch {
      // Clear local session UI regardless
    }
    setIsSecurityModalOpen(false);
    setAuthUser(null);
    setStateLoadedForUserId(null);
    setState(createInitialSeedState());
  };

  // Legacy localStorage migration handlers
  const handleImportLegacyLocal = async () => {
    if (!legacyLocalState) return;
    setMigratingLegacy(true);
    try {
      const normalized = normalizeAppState(legacyLocalState);
      await saveCloudGameState(normalized);
      isHydratingRef.current = true;
      setState(normalized);
      latestStateRef.current = normalized;
      setIsOnboardingOpen(!normalized.hasCompletedOnboarding);
      clearLegacyLocalState();
      setLegacyLocalState(null);
      setSyncStatus('synced');
      pushToast(
        '☁️ Progresso Migrado para o Banco!',
        'Seus dados foram salvos na nuvem e o localStorage antigo foi limpo.',
        'reward'
      );
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 0);
    } catch {
      setSyncStatus('error');
      pushToast(
        'Falha na migração',
        'Não foi possível salvar os dados migrados agora. Tente novamente.',
        'info'
      );
    } finally {
      setMigratingLegacy(false);
    }
  };

  const handleDiscardLegacyLocal = () => {
    clearLegacyLocalState();
    setLegacyLocalState(null);
    pushToast(
      '🧹 Armazenamento Local Limpo',
      'O localStorage antigo foi removido. Agora tudo fica salvo no banco de dados.',
      'info'
    );
  };

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
          setState(normalizeAppState(parsed));
          pushToast(
            '✅ Progresso Restaurado!',
            'Seu backup JSON foi carregado e sincronizado na nuvem.',
            'info'
          );
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

  // Loading Splash Screen (Auth or Cloud State Hydration)
  if (authChecking || (authUser && stateLoading)) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] p-0.5 shadow-xl shadow-violet-500/25 mb-4">
          <div className="w-full h-full rounded-[14px] bg-[#0B0F19] flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
          </div>
        </div>
        <p className="text-sm font-bold text-white">
          {authChecking ? 'Verificando sua sessão...' : 'Carregando seu progresso da nuvem...'}
        </p>
        <p className="text-xs text-slate-400 mt-1">FocusQuest RPG</p>
      </div>
    );
  }

  // Unauthenticated -> Login / Sign Up Page with Passkeys
  if (!authUser) {
    return (
      <AuthPage
        onAuthenticated={handleAuthenticated}
        hasLegacyLocalData={Boolean(legacyLocalState)}
      />
    );
  }

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
          user={authUser}
          syncStatus={syncStatus}
          onRetrySync={() => flushCloudSave(false)}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          onLogout={handleLogout}
          onToggleSound={handleToggleSound}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onResetSeed={handleResetSeed}
          onStartOnboarding={handleStartOnboarding}
        />

        {/* One-time Legacy localStorage Migration Banner */}
        {legacyLocalState && (
          <LocalMigrationBanner
            legacyState={legacyLocalState}
            importing={migratingLegacy}
            onImport={handleImportLegacyLocal}
            onDiscard={handleDiscardLegacyLocal}
          />
        )}

        {/* Gentle Passkey Setup Banner if user signed up with password and has 0 passkeys */}
        {authUser.passkeysCount === 0 && !dismissedPasskeyPrompt && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 flex-shrink-0">
                <Fingerprint className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm text-amber-100">
                <strong className="text-amber-300">Configure sua Passkey!</strong> Entre com
                digital, Face ID ou PIN em 1 clique sem precisar digitar senha.
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setIsSecurityModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Configurar agora
              </button>
              <button
                type="button"
                onClick={() => setDismissedPasskeyPrompt(true)}
                className="p-1.5 rounded-lg text-amber-300/70 hover:text-amber-200"
                aria-label="Dispensar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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

      {/* Account & Passkeys Configuration Modal */}
      <AccountSecurityModal
        isOpen={isSecurityModalOpen}
        user={authUser}
        onClose={() => setIsSecurityModalOpen(false)}
        onUserUpdated={setAuthUser}
        onLogout={handleLogout}
        onNotify={pushToast}
      />

      {/* Interactive Gamified Onboarding Tour (Hidden while inside fullscreen Tunnel Mode or Security Modal) */}
      <OnboardingTour
        isOpen={isOnboardingOpen && !activeTunnelQuest && !isSecurityModalOpen}
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
