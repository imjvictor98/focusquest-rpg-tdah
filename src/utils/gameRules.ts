import { AppState, Difficulty, PlayerState, Quest } from '../types';

export const STORAGE_KEY = 'focusquest_state_v1';
export const COMBO_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const REWARD_TABLE: Record<Difficulty, { xp: number; coins: number; label: string; badge: string }> = {
  quick: {
    xp: 15,
    coins: 5,
    label: 'Rápida (2 min)',
    badge: '+15 XP · +5 🪙',
  },
  medium: {
    xp: 35,
    coins: 12,
    label: 'Média',
    badge: '+35 XP · +12 🪙',
  },
  boss: {
    xp: 100,
    coins: 40,
    label: 'Boss (Complexa)',
    badge: '15 XP/passo + 100 XP Bônus',
  },
};

export const SUBTASK_BASE_XP = 15;
export const SUBTASK_BASE_COINS = 5;
export const BOSS_VICTORY_BONUS_XP = 100;
export const BOSS_VICTORY_BONUS_COINS = 40;
export const ONBOARDING_BONUS_XP = 30;
export const ONBOARDING_BONUS_COINS = 20;

export function calculateXpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.25, Math.max(1, level) - 1));
}

export function getComboMultiplier(comboCount: number): number {
  if (comboCount <= 1) return 1.0;
  if (comboCount === 2) return 1.5;
  if (comboCount === 3) return 2.0;
  if (comboCount === 4) return 2.5;
  return 3.0; // 5+ actions = 3.0x Max (ON FIRE)
}

export function calculateBossHpPercentage(quest: Quest): number {
  if (quest.difficulty !== 'boss') return quest.completed ? 0 : 100;
  if (quest.completed) return 0;
  const total = quest.subtasks.length;
  if (total === 0) return 100;
  const remaining = quest.subtasks.filter((s) => !s.completed).length;
  return Math.round((remaining / total) * 100);
}

/**
 * Applies XP & Coins to the player state, advancing levels automatically if currentXp >= xpToNextLevel.
 */
export function applyPlayerRewards(
  player: PlayerState,
  baseXp: number,
  baseCoins: number,
  now = Date.now(),
  incrementQuestCount = false
): {
  updatedPlayer: PlayerState;
  earnedXp: number;
  earnedCoins: number;
  leveledUp: boolean;
  newLevel: number;
} {
  // Check if previous combo is still active within 30 minutes
  const isComboAlive =
    player.lastActionTimestamp !== null &&
    now - player.lastActionTimestamp <= COMBO_TIMEOUT_MS;

  const nextComboCount = isComboAlive ? player.comboCount + 1 : 1;
  const nextMultiplier = getComboMultiplier(nextComboCount);

  const earnedXp = Math.round(baseXp * nextMultiplier);
  const earnedCoins = Math.round(baseCoins * nextMultiplier);

  let level = player.level;
  let currentXp = player.currentXp + earnedXp;
  let xpToNextLevel = player.xpToNextLevel;
  let leveledUp = false;

  while (currentXp >= xpToNextLevel) {
    currentXp -= xpToNextLevel;
    level += 1;
    xpToNextLevel = calculateXpToNextLevel(level);
    leveledUp = true;
  }

  const updatedPlayer: PlayerState = {
    ...player,
    level,
    currentXp,
    xpToNextLevel,
    coins: player.coins + earnedCoins,
    comboCount: nextComboCount,
    comboMultiplier: nextMultiplier,
    lastActionTimestamp: now,
    totalQuestsCompleted: incrementQuestCount
      ? player.totalQuestsCompleted + 1
      : player.totalQuestsCompleted,
  };

  return {
    updatedPlayer,
    earnedXp,
    earnedCoins,
    leveledUp,
    newLevel: level,
  };
}

export const ONBOARDING_QUEST_ID = 'quest-onboarding-welcome';

export function createOnboardingBossQuest(): Quest {
  const now = Date.now();
  return {
    id: ONBOARDING_QUEST_ID,
    title: '🐉 Boss de Treinamento: Primeiros Passos no FocusQuest',
    difficulty: 'boss',
    completed: false,
    createdAt: now,
    subtasks: [
      {
        id: 'sub-onboarding-1',
        title: '1º Golpe: Clique em "Atacar" para testar o dano ao Boss e ganhar XP',
        completed: false,
        xpReward: SUBTASK_BASE_XP,
        coinReward: SUBTASK_BASE_COINS,
      },
      {
        id: 'sub-onboarding-2',
        title: '2º Golpe: Experimentar o botão "Modo Túnel" para isolar o foco',
        completed: false,
        xpReward: SUBTASK_BASE_XP,
        coinReward: SUBTASK_BASE_COINS,
      },
      {
        id: 'sub-onboarding-3',
        title: 'Golpe Final: Criar sua primeira missão real no campo "Nova Missão" acima',
        completed: false,
        xpReward: SUBTASK_BASE_XP,
        coinReward: SUBTASK_BASE_COINS,
      },
    ],
  };
}

export function createInitialSeedState(): AppState {
  return {
    player: {
      level: 1,
      currentXp: 0,
      xpToNextLevel: calculateXpToNextLevel(1), // 100
      coins: 0,
      comboCount: 0,
      comboMultiplier: 1.0,
      lastActionTimestamp: null,
      totalQuestsCompleted: 0,
      soundEnabled: true,
    },
    quests: [createOnboardingBossQuest()],
    rewards: [
      {
        id: 'reward-1',
        title: '15 min de Redes Sociais / YouTube sem culpa',
        cost: 40,
        icon: 'Smartphone',
        redeemedCount: 0,
      },
      {
        id: 'reward-2',
        title: 'Café Especial ou Lanche Favorito',
        cost: 90,
        icon: 'Coffee',
        redeemedCount: 0,
      },
      {
        id: 'reward-3',
        title: '30 min de Game / Episódio de Série',
        cost: 150,
        icon: 'Gamepad2',
        redeemedCount: 0,
      },
    ],
    brainDump: [],
    activeTunnelTask: null,
    hasCompletedOnboarding: false,
  };
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialSeedState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !parsed.player || !Array.isArray(parsed.quests)) {
      return createInitialSeedState();
    }
    // Silent combo expiration check on load (Zero punishment)
    const now = Date.now();
    if (
      parsed.player.lastActionTimestamp &&
      now - parsed.player.lastActionTimestamp > COMBO_TIMEOUT_MS
    ) {
      parsed.player.comboCount = 0;
      parsed.player.comboMultiplier = 1.0;
    }
    return parsed;
  } catch {
    return createInitialSeedState();
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors safely
  }
}
