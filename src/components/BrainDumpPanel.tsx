import React, { useState } from 'react';
import { Brain, ArrowUpRight, Trash2, Plus, Sparkles } from 'lucide-react';
import { BrainDumpItem } from '../types';

interface BrainDumpPanelProps {
  items: BrainDumpItem[];
  onAdd: (text: string) => void;
  onConvertToQuest: (item: BrainDumpItem) => void;
  onDiscard: (id: string) => void;
}

export const BrainDumpPanel: React.FC<BrainDumpPanelProps> = ({
  items,
  onAdd,
  onConvertToQuest,
  onDiscard,
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };

  return (
    <section
      data-onboarding-id="brain-dump"
      className="bg-[#131A2A] border border-[#1E293B] rounded-2xl p-5 shadow-lg space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            Bloco de Despejo (Brain Dump)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Capture ideias paralelas ou distrações para não perder o foco atual
          </p>
        </div>
        <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          {items.length}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Anotar pensamento rápido..."
          className="flex-1 bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-3.5 py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/40 text-violet-200 text-xs font-bold disabled:opacity-40 flex items-center gap-1 shrink-0 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Salvar</span>
        </button>
      </form>

      {items.length === 0 ? (
        <div className="bg-[#0B0F19]/50 border border-dashed border-[#1E293B] rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            Mente leve! Nenhum pensamento pendente estacionado.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-[#0B0F19] border border-[#1E293B] hover:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
            >
              <p className="text-xs sm:text-sm text-slate-200 break-words flex-1">
                {item.text}
              </p>
              <div className="flex items-center justify-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onConvertToQuest(item)}
                  className="px-2.5 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Mover diretamente para a lista de Missões"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Converter em Missão</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDiscard(item.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/70 transition-colors"
                  title="Descartar pensamento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
