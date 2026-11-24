import type { AppState } from '../../../src/types';

export const COMBO_TIMEOUT_MS = 30 * 60 * 1000;
const SUBTASK_BASE_XP = 15;
const SUBTASK_BASE_COINS = 5;
const ONBOARDING_QUEST_ID = 'quest-onboarding-welcome';

function calculateXpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.25, Math.max(1, level) - 1));
}

export function createServerInitialState(): AppState {
  const now = Date.now();
  return {
    player: {
      level: 1,
      currentXp: 0,
      xpToNextLevel: calculateXpToNextLevel(1),
      coins: 0,
      comboCount: 0,
      comboMultiplier: 1.0,
      lastActionTimestamp: null,
      totalQuestsCompleted: 0,
      soundEnabled: true,
    },
    quests: [
      {
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
      },
    ],
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

export function isValidAppState(candidate: unknown): candidate is AppState {
  if (!candidate || typeof candidate !== 'object') return false;
  const s = candidate as Partial<AppState>;
  if (!s.player || typeof s.player !== 'object') return false;
  if (typeof s.player.level !== 'number' || typeof s.player.currentXp !== 'number') return false;
  if (typeof s.player.coins !== 'number') return false;
  if (!Array.isArray(s.quests)) return false;
  if (!Array.isArray(s.rewards)) return false;
  if (!Array.isArray(s.brainDump)) return false;
  return true;
}

export function normalizeAppState(state: AppState): AppState {
  const now = Date.now();
  const normalized: AppState = {
    ...state,
    player: {
      ...state.player,
      xpToNextLevel:
        state.player.xpToNextLevel || calculateXpToNextLevel(state.player.level || 1),
    },
  };

  if (
    normalized.player.lastActionTimestamp &&
    now - normalized.player.lastActionTimestamp > COMBO_TIMEOUT_MS
  ) {
    normalized.player.comboCount = 0;
    normalized.player.comboMultiplier = 1.0;
  }

  return normalized;
}
