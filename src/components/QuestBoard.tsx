import React, { useState } from 'react';
import {
  Sword,
  Zap,
  ShieldAlert,
  Focus,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Skull,
  Wand2,
} from 'lucide-react';
import { Difficulty, Quest } from '../types';
import {
  calculateBossHpPercentage,
  REWARD_TABLE,
  SUBTASK_BASE_COINS,
  SUBTASK_BASE_XP,
} from '../utils/gameRules';

interface QuestBoardProps {
  quests: Quest[];
  comboMultiplier: number;
  onAddQuest: (title: string, difficulty: Difficulty, subtaskTitles: string[]) => void;
  onCompleteQuest: (questId: string, event: React.MouseEvent) => void;
  onCompleteSubtask: (questId: string, subtaskId: string, event: React.MouseEvent) => void;
  onAddSubtaskToBoss: (questId: string, title: string) => void;
  onDeleteQuest: (questId: string) => void;
  onEnterTunnel: (questId: string, subtaskId?: string) => void;
}

export const QuestBoard: React.FC<QuestBoardProps> = ({
  quests,
  comboMultiplier,
  onAddQuest,
  onCompleteQuest,
  onCompleteSubtask,
  onAddSubtaskToBoss,
  onDeleteQuest,
  onEnterTunnel,
}) => {
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('quick');
  const [subtaskDrafts, setSubtaskDrafts] = useState<string[]>([
    '',
    '',
  ]);
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});
  const [hitBossId, setHitBossId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const activeQuests = quests.filter((q) => !q.completed);
  const completedQuests = quests.filter((q) => q.completed);

  const handleCreateQuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let cleanSubtasks = subtaskDrafts.map((s) => s.trim()).filter(Boolean);
    if (difficulty === 'boss' && cleanSubtasks.length === 0) {
      // Auto-populate 3 low-friction ADHD micro-steps if user left them empty
      cleanSubtasks = [
        `Abrir as ferramentas/arquivos para: ${title.trim()} (Regra dos 2 min)`,
        'Fazer os primeiros 5 minutos sem julgar o resultado',
        'Revisar e finalizar o bloco principal',
      ];
    }

    onAddQuest(title.trim(), difficulty, cleanSubtasks);
    setTitle('');
    setSubtaskDrafts(['', '']);
  };

  const handleAutoBreakdown = () => {
    const baseName = title.trim() || 'esta tarefa';
    setSubtaskDrafts([
      `1º Micro-passo: Preparar o ambiente e abrir apenas o necessário para "${baseName}"`,
      `2º Micro-passo: Executar 10 minutos focados no núcleo da tarefa`,
      `3º Micro-passo: Dar o check final e celebrar a entrega`,
    ]);
  };

  const handleSubtaskClick = (questId: string, subtaskId: string, e: React.MouseEvent) => {
    setHitBossId(questId);
    setTimeout(() => setHitBossId((prev) => (prev === questId ? null : prev)), 400);
    onCompleteSubtask(questId, subtaskId, e);
  };

  return (
    <div className="space-y-6">
      {/* Create Quest Card */}
      <div
        data-onboarding-id="quest-creator"
        className="bg-[#131A2A] border border-[#1E293B] rounded-2xl p-5 shadow-lg"
      >
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Sword className="w-5 h-5 text-violet-400" />
            Nova Missão
          </h2>
          <span className="text-xs text-slate-400">
            Multiplicador atual:{' '}
            <strong className="text-amber-400 font-mono">{comboMultiplier.toFixed(1)}x</strong>
          </span>
        </div>

        <form onSubmit={handleCreateQuest} className="space-y-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Qual é a próxima ação? (Ex: Responder e-mail, Estudar módulo 1...)"
              className="flex-1 bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
            />
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Missão</span>
            </button>
          </div>

          {/* Difficulty Selector Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['quick', 'medium', 'boss'] as Difficulty[]).map((diff) => {
              const selected = difficulty === diff;
              const info = REWARD_TABLE[diff];
              return (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                    selected
                      ? diff === 'boss'
                        ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-500/60 text-white'
                        : 'bg-violet-500/20 border-violet-500/60 text-white'
                      : 'bg-[#0B0F19]/60 border-[#1E293B] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {diff === 'quick' && <Zap className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {diff === 'medium' && <Sword className="w-4 h-4 text-violet-400 shrink-0" />}
                    {diff === 'boss' && <Skull className="w-4 h-4 text-red-400 shrink-0" />}
                    <span className="text-xs font-bold">{info.label}</span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-300/90">{info.badge}</span>
                </button>
              );
            })}
          </div>

          {/* Boss Subtasks Builder */}
          {difficulty === 'boss' && (
            <div className="bg-[#0B0F19]/90 border border-red-500/30 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  Quebrar Chefão em Micro-Passos (Cada passo concluído drena o HP do Boss!)
                </span>
                <button
                  type="button"
                  onClick={handleAutoBreakdown}
                  className="text-xs font-semibold text-violet-300 hover:text-violet-200 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Sugerir 3 micro-passos anti-paralisia
                </button>
              </div>

              <div className="space-y-2">
                {subtaskDrafts.map((draft, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 w-5">{idx + 1}.</span>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => {
                        const copy = [...subtaskDrafts];
                        copy[idx] = e.target.value;
                        setSubtaskDrafts(copy);
                      }}
                      placeholder={`Micro-passo ${idx + 1} (Ex: Abrir documento e escrever o título)`}
                      className="flex-1 bg-[#131A2A] border border-[#1E293B] focus:border-red-400 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    {subtaskDrafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSubtaskDrafts(subtaskDrafts.filter((_, i) => i !== idx))
                        }
                        className="text-slate-500 hover:text-slate-300 p-1"
                        title="Remover micro-passo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setSubtaskDrafts([...subtaskDrafts, ''])}
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 pt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar mais um micro-passo
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Active Quests List */}
      <div data-onboarding-id="active-quests" className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>Missões Ativas</span>
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              {activeQuests.length}
            </span>
          </h3>
          <span className="text-xs text-slate-500">
            Dica: Clique em <strong className="text-violet-400">Túnel</strong> para isolar uma única tarefa
          </span>
        </div>

        {activeQuests.length === 0 ? (
          <div className="bg-[#131A2A]/70 border border-dashed border-[#1E293B] rounded-2xl p-8 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-violet-400 mx-auto" />
            <p className="text-base font-bold text-white">
              {completedQuests.length === 0
                ? 'Sua jornada começa agora! Crie sua primeira missão acima.'
                : 'Quadro limpo! Todas as missões atuais foram vencidas.'}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {completedQuests.length === 0
                ? 'Digite qualquer tarefa no campo "Nova Missão" acima — escolha Rápida (2 min), Média ou Boss — para começar a ganhar XP e moedas!'
                : 'Aproveite sua dopamina, resgate uma recompensa na loja ao lado ou adicione uma nova missão acima quando quiser.'}
            </p>
          </div>
        ) : (
          activeQuests.map((quest) => {
            const isBoss = quest.difficulty === 'boss';
            const bossHp = isBoss ? calculateBossHpPercentage(quest) : 100;
            const completedSubtasks = quest.subtasks.filter((s) => s.completed).length;
            const totalSubtasks = quest.subtasks.length;
            const firstPendingSubtask = quest.subtasks.find((s) => !s.completed);

            const scaledXp = Math.round(REWARD_TABLE[quest.difficulty].xp * comboMultiplier);
            const scaledCoins = Math.round(REWARD_TABLE[quest.difficulty].coins * comboMultiplier);

            if (isBoss) {
              return (
                <div
                  key={quest.id}
                  data-onboarding-id="boss-quest-card"
                  className={`bg-[#131A2A] border-2 border-red-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all ${
                    hitBossId === quest.id ? 'animate-boss-hit border-orange-400' : ''
                  }`}
                >
                  {/* Subtle Crimson Ambient Glow */}
                  <div className="absolute -top-12 -right-12 w-36 h-36 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Boss Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#EF4444] to-[#F97316] text-white shadow-md shadow-red-500/20 shrink-0 mt-0.5">
                        <Skull className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30">
                            BOSS QUEST
                          </span>
                          <span className="text-xs font-mono text-amber-400">
                            Bônus Final: +{scaledXp} XP · +{scaledCoins} 🪙
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-extrabold text-white mt-1">
                          {quest.title}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {firstPendingSubtask && (
                        <button
                          onClick={() => onEnterTunnel(quest.id, firstPendingSubtask.id)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-500/40 flex items-center gap-1.5 transition-all active:scale-95"
                          title="Atacar o próximo micro-passo em Modo Túnel"
                        >
                          <Focus className="w-3.5 h-3.5 text-violet-400" />
                          <span>Modo Túnel</span>
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteQuest(quest.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
                        title="Remover missão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Boss HP Bar */}
                  <div className="mb-4 bg-[#0B0F19] p-3 rounded-xl border border-[#1E293B]">
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="text-red-400 flex items-center gap-1.5">
                        <span>HP DO BOSS</span>
                        <span className="text-[11px] font-normal text-slate-400">
                          ({completedSubtasks}/{totalSubtasks} micro-passos destruídos)
                        </span>
                      </span>
                      <span className="font-mono text-orange-400">{bossHp}% HP</span>
                    </div>
                    <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden border border-red-950/60 p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#EF4444] to-[#F97316] transition-all duration-500 ease-out"
                        style={{ width: `${bossHp}%` }}
                      />
                    </div>
                  </div>

                  {/* Subtasks (Micro-steps) */}
                  <div className="space-y-2">
                    {quest.subtasks.map((sub) => {
                      const subXp = Math.round(SUBTASK_BASE_XP * comboMultiplier);
                      const subCoins = Math.round(SUBTASK_BASE_COINS * comboMultiplier);
                      const hpDamage = Math.round(100 / Math.max(1, totalSubtasks));

                      return (
                        <div
                          key={sub.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                            sub.completed
                              ? 'bg-[#0B0F19]/40 border-[#1E293B]/60 opacity-60'
                              : 'bg-[#0B0F19] border-[#1E293B] hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                              type="button"
                              disabled={sub.completed}
                              onClick={(e) => handleSubtaskClick(quest.id, sub.id, e)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                                sub.completed
                                  ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                  : 'bg-[#131A2A] border-slate-600 hover:border-emerald-400 hover:bg-emerald-500/15 text-transparent hover:text-emerald-400 active:scale-90'
                              }`}
                              title={sub.completed ? 'Micro-passo concluído!' : 'Causar dano ao Boss!'}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <span
                              className={`text-sm font-medium break-words ${
                                sub.completed ? 'line-through text-slate-500' : 'text-slate-100'
                              }`}
                            >
                              {sub.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!sub.completed && (
                              <>
                                <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                                  -{hpDamage}% HP · +{subXp} XP
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onEnterTunnel(quest.id, sub.id)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#131A2A] hover:bg-violet-500/20 text-slate-300 hover:text-violet-300 border border-[#1E293B] hover:border-violet-500/40 flex items-center gap-1 transition-colors"
                                  title="Focar apenas neste micro-passo"
                                >
                                  <Focus className="w-3 h-3 text-violet-400" />
                                  <span>Túnel</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleSubtaskClick(quest.id, sub.id, e)}
                                  className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 transition-all active:scale-95"
                                >
                                  Atacar (+{subCoins}🪙)
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add extra micro-step to Boss */}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={newSubtaskInputs[quest.id] || ''}
                      onChange={(e) =>
                        setNewSubtaskInputs({
                          ...newSubtaskInputs,
                          [quest.id]: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (newSubtaskInputs[quest.id] || '').trim();
                          if (val) {
                            onAddSubtaskToBoss(quest.id, val);
                            setNewSubtaskInputs({ ...newSubtaskInputs, [quest.id]: '' });
                          }
                        }
                      }}
                      placeholder="+ Adicionar outro micro-passo a este Boss..."
                      className="flex-1 bg-[#0B0F19]/70 border border-[#1E293B] focus:border-violet-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = (newSubtaskInputs[quest.id] || '').trim();
                        if (val) {
                          onAddSubtaskToBoss(quest.id, val);
                          setNewSubtaskInputs({ ...newSubtaskInputs, [quest.id]: '' });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0B0F19] hover:bg-slate-800 text-slate-300 border border-[#1E293B]"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              );
            }

            // Standard Quick or Medium Quest Card
            return (
              <div
                key={quest.id}
                className="bg-[#131A2A] hover:bg-[#172033] border border-[#1E293B] rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all"
              >
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => onCompleteQuest(quest.id, e)}
                    className="w-7 h-7 rounded-xl bg-[#0B0F19] border-2 border-emerald-500/60 hover:border-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 transition-all active:scale-90 mt-0.5 sm:mt-0"
                    title="Concluir Missão!"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          quest.difficulty === 'quick'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                        }`}
                      >
                        {quest.difficulty === 'quick' ? '⚡ Rápida (2 min)' : '⚔️ Missão Média'}
                      </span>
                      <span className="text-xs font-mono text-amber-400">
                        +{scaledXp} XP · +{scaledCoins} 🪙
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-semibold text-white break-words">
                      {quest.title}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEnterTunnel(quest.id)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-[#0B0F19] hover:bg-violet-500/20 text-slate-300 hover:text-violet-200 border border-[#1E293B] hover:border-violet-500/40 flex items-center gap-1.5 transition-all active:scale-95"
                    title="Isolar esta tarefa em Modo Túnel (Hiperfoco)"
                  >
                    <Focus className="w-3.5 h-3.5 text-violet-400" />
                    <span>Túnel</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => onCompleteQuest(quest.id, e)}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    Concluir
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteQuest(quest.id)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
                    title="Descartar missão"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Completed Quests History (Positive Reinforcement) */}
      {completedQuests.length > 0 && (
        <div className="bg-[#131A2A]/60 border border-[#1E293B] rounded-2xl p-4">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Conquistas Recentes ({completedQuests.length})
            </span>
            {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showCompleted && (
            <div className="mt-3 space-y-2 pt-3 border-t border-[#1E293B]">
              {completedQuests.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-[#0B0F19]/60 text-slate-400"
                >
                  <span className="line-through text-slate-400 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {q.title}
                  </span>
                  <span className="font-mono text-emerald-400/90 uppercase text-[10px]">
                    {q.difficulty === 'boss' ? '🏆 Boss Derrotado' : 'Concluída'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
