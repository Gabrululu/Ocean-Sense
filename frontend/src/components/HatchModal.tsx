import { useState } from "react";
import { SPECIES } from "../constants";

interface Props {
  usdcBalance: number;
  loading: boolean;
  onHatch: (name: string, species: number) => void;
  onClose: () => void;
}

export function HatchModal({ usdcBalance, loading, onHatch, onClose }: Props) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState(0);

  const canAfford = usdcBalance >= 1;
  const nameValid = name.length >= 1 && name.length <= 32;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameValid || !canAfford) return;
    onHatch(name.trim(), species);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="pixel-card p-6 w-full max-w-sm">
        <h2 className="pixel-text text-pink-300 text-sm mb-1">Nuevo Huevo</h2>
        <p className="text-gray-400 text-xs mb-5">Cuesta 1 USDC · Nivel 1 al nacer</p>

        <form onSubmit={handleSubmit}>
          {/* Nombre */}
          <label className="block text-xs text-gray-300 font-mono mb-1">
            Nombre
          </label>
          <input
            autoFocus
            maxLength={32}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mochi, Luna, Tofu…"
            className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm mb-4 border border-gray-700 focus:outline-none focus:border-pink-400"
          />

          {/* Especie */}
          <label className="block text-xs text-gray-300 font-mono mb-2">
            Especie
          </label>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {SPECIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpecies(s.id)}
                className={`flex flex-col items-center py-2 rounded text-xs transition-all ${
                  species === s.id
                    ? "bg-pink-600 text-white pixel-border"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                <span className="text-2xl mb-0.5">{s.emoji}</span>
                {s.name}
              </button>
            ))}
          </div>

          {/* Saldo */}
          {!canAfford && (
            <p className="text-red-400 text-xs mb-3 font-mono">
              Necesitas al menos 1 USDC (tienes {usdcBalance.toFixed(2)})
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !nameValid || !canAfford}
              className="btn-pink flex-1 py-3 text-xs"
            >
              {loading ? "Eclosionando…" : `Eclosionar · 1 USDC`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-outline flex-1 py-3 text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
