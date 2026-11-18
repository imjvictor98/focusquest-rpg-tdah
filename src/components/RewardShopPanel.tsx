import React, { useState } from 'react';
import {
  ShoppingBag,
  Coins,
  Plus,
  Coffee,
  Smartphone,
  Gamepad2,
  Music,
  Sparkles,
  Trash2,
  Gift,
} from 'lucide-react';
import { RewardItem } from '../types';

interface RewardShopPanelProps {
  rewards: RewardItem[];
  playerCoins: number;
  onRedeem: (reward: RewardItem, event: React.MouseEvent) => void;
  onAddReward: (title: string, cost: number, icon: string) => void;
  onDeleteReward: (id: string) => void;
}

const ICON_OPTIONS = [
  { name: 'Smartphone', label: 'Redes / Vídeo', Icon: Smartphone },
  { name: 'Coffee', label: 'Café / Lanche', Icon: Coffee },
  { name: 'Gamepad2', label: 'Game / Série', Icon: Gamepad2 },
  { name: 'Music', label: 'Música / Pausa', Icon: Music },
  { name: 'Gift', label: 'Mimo Pessoal', Icon: Gift },
];

export const RewardShopPanel: React.FC<RewardShopPanelProps> = ({
  rewards,
  playerCoins,
  onRedeem,
  onAddReward,
  onDeleteReward,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(50);
  const [selectedIcon, setSelectedIcon] = useState('Coffee');

  const renderIcon = (iconName: string) => {
    const found = ICON_OPTIONS.find((i) => i.name === iconName);
    const IconComp = found ? found.Icon : Gift;
    return <IconComp className="w-4 h-4" />;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || cost <= 0) return;
    onAddReward(title.trim(), Number(cost), selectedIcon);
    setTitle('');
    setCost(50);
    setShowAddForm(false);
  };

  return (
    <section
      data-onboarding-id="reward-shop"
      className="bg-[#131A2A] border border-[#1E293B] rounded-2xl p-5 shadow-lg space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            Loja de Recompensas Reais
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Troque suas moedas por descanso e dopamina sem culpa
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddForm ? 'Fechar' : 'Nova'}</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="bg-[#0B0F19] border border-amber-500/30 rounded-xl p-3.5 space-y-3"
        >
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-400">
              Recompensa do Mundo Real
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 20 min de TikTok/YouTube, Chocolate, Cochilo..."
              className="w-full bg-[#131A2A] border border-[#1E293B] focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="w-full sm:w-28">
              <label className="text-[11px] font-bold uppercase text-slate-400">
                Custo (🪙)
              </label>
              <input
                type="number"
                min={5}
                step={5}
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="w-full mt-1 bg-[#131A2A] border border-[#1E293B] focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs font-mono text-amber-300 focus:outline-none"
              />
            </div>

            <div className="flex-1">
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Ícone
              </label>
              <div className="flex items-center gap-1.5">
                {ICON_OPTIONS.map(({ name, label, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedIcon(name)}
                    title={label}
                    className={`p-2 rounded-lg border transition-all ${
                      selectedIcon === name
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-[#131A2A] border-[#1E293B] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all disabled:opacity-40"
          >
            Cadastrar Recompensa na Loja
          </button>
        </form>
      )}

      {/* Rewards List */}
      <div className="space-y-2.5">
        {rewards.map((reward) => {
          const canAfford = playerCoins >= reward.cost;
          return (
            <div
              key={reward.id}
              className="bg-[#0B0F19] border border-[#1E293B] hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    canAfford
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-800/70 text-slate-500 border border-slate-800'
                  }`}
                >
                  {renderIcon(reward.icon)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-bold text-white break-words">
                    {reward.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {reward.cost} moedas
                    </span>
                    {reward.redeemedCount > 0 && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                        Resgatado {reward.redeemedCount}x
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={(e) => onRedeem(reward, e)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    canAfford
                      ? 'bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-slate-950 shadow-md shadow-amber-500/15 active:scale-95'
                      : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                  }`}
                  title={
                    canAfford
                      ? 'Resgatar descanso merecido agora!'
                      : `Faltam ${reward.cost - playerCoins} moedas`
                  }
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Resgatar</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteReward(reward.id)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 transition-colors"
                  title="Remover da loja"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
