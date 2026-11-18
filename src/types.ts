export type Difficulty = 'quick' | 'medium' | 'boss';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  xpReward: number;
  coinReward: number;
}

export interface Quest {
  id: string;
  title: string;
  difficulty: Difficulty; // 'quick' (15 XP), 'medium' (35 XP), 'boss' (100+ XP)
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  // Para Quests do tipo 'boss', o HP é calculado com base nas subtasks
  subtasks: Subtask[];
}

export interface RewardItem {
  id: string;
  title: string;
  cost: number;
  icon: string;
  redeemedCount: number;
}

export interface BrainDumpItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface PlayerState {
  level: number;
  currentXp: number;
  xpToNextLevel: number; // Fórmula: Math.floor(100 * Math.pow(1.25, level - 1))
  coins: number;
  comboCount: number;
  comboMultiplier: number; // 1.0, 1.5, 2.0, 2.5, 3.0 (Max)
  lastActionTimestamp: number | null; // Para expirar o combo após X minutos de inatividade (ex: 30 min)
  totalQuestsCompleted: number;
  soundEnabled: boolean;
}

export interface AppState {
  player: PlayerState;
  quests: Quest[];
  rewards: RewardItem[];
  brainDump: BrainDumpItem[];
  activeTunnelTask: {
    questId: string;
    subtaskId?: string;
  } | null;
  hasCompletedOnboarding?: boolean;
}

export interface FloatingFeedback {
  id: string;
  x: number;
  y: number;
  xpText: string;
  coinText?: string;
  damageText?: string;
  isBossDefeat?: boolean;
}

export interface ToastNotification {
  id: string;
  title: string;
  subtitle?: string;
  type: 'reward' | 'boss' | 'combo' | 'info';
}
