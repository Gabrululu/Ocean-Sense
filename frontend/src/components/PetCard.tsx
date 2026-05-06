import { useState } from "react";
import { SPECIES, MIN_FEED_USDC } from "../constants";
import {
  type PetAccount,
  computeCurrentHunger,
  computePlayCooldownMs,
} from "../hooks/useStablePaws";

interface Props {
  pet: PetAccount;
  usdcBalance: number;
  loading: boolean;
  onFeed: (name: string, amount: number) => void;
  onPlay: (name: string) => void;
}

function StatBar({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1 font-mono">
        <span className="text-gray-300">{label}</span>
        <span className="text-white font-bold">{value}/100</span>
      </div>
      <div className="w-full h-3 bg-gray-800 rounded pixel-border overflow-hidden">
        <div
          className={`h-full rounded transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function XpBar({ xp }: { xp: number }) {
  const level = Math.floor(xp / 1000) + 1;
  const xpInLevel = xp % 1000;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1 font-mono">
        <span className="text-gray-300">XP</span>
        <span className="text-yellow-300 font-bold">{xpInLevel}/1000</span>
      </div>
      <div className="w-full h-3 bg-gray-800 rounded pixel-border overflow-hidden">
        <div
          className="h-full rounded bg-yellow-400 transition-all duration-700"
          style={{ width: `${xpInLevel / 10}%` }}
        />
      </div>
      <div className="text-right text-xs text-yellow-400 mt-0.5">Nivel {level}</div>
    </div>
  );
}

export function PetCard({ pet, usdcBalance, loading, onFeed, onPlay }: Props) {
  const [feedAmount, setFeedAmount] = useState(1);
  const [showFeed, setShowFeed] = useState(false);

  const species = SPECIES[pet.species] ?? SPECIES[0];
  const currentHunger = computeCurrentHunger(pet);
  const cooldownMs = computePlayCooldownMs(pet);
  const playReady = cooldownMs === 0;
  const cooldownHours = Math.ceil(cooldownMs / 3600000);

  const hungerColor =
    currentHunger >= 60
      ? "bg-green-400"
      : currentHunger >= 30
      ? "bg-yellow-400"
      : "bg-red-500";

  const moodEmoji =
    currentHunger < 20
      ? "😵"
      : pet.happiness < 30
      ? "😢"
      : pet.happiness >= 80 && currentHunger >= 60
      ? "🤩"
      : "😊";

  const petAnimation =
    currentHunger < 20
      ? "animate-pulse opacity-70"
      : "animate-bounce-slow";

  function handleFeedConfirm() {
    onFeed(pet.name, feedAmount * 1_000_000);
    setShowFeed(false);
  }

  return (
    <div className="pixel-card p-6 max-w-sm w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="pixel-text text-pink-300 text-sm">{pet.name}</h2>
          <div className="text-gray-400 text-xs mt-1">
            {species.name} · Nivel {pet.level}
          </div>
        </div>
        <div className="text-5xl leading-none select-none relative">
          <span className={petAnimation}>{species.emoji}</span>
          <span className="absolute -top-1 -right-1 text-base">{moodEmoji}</span>
        </div>
      </div>

      {/* Bars */}
      <div className="mb-4">
        <StatBar value={currentHunger} color={hungerColor} label="Hambre" />
        <StatBar
          value={pet.happiness}
          color="bg-purple-400"
          label="Felicidad"
        />
        <XpBar xp={pet.xp.toNumber()} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-5 text-xs text-gray-400 font-mono">
        <div>
          USDC gastado
          <div className="text-pink-300 font-bold">
            {(pet.totalStablesFed.toNumber() / 1_000_000).toFixed(2)}
          </div>
        </div>
        <div>
          Tu saldo
          <div className="text-green-300 font-bold">
            {usdcBalance.toFixed(2)} USDC
          </div>
        </div>
      </div>

      {/* Feed panel */}
      {showFeed ? (
        <div className="mb-4 pixel-border p-3 bg-gray-900 rounded">
          <p className="text-xs text-gray-300 mb-2 font-mono">
            Cuánto USDC dar?
          </p>
          <input
            type="number"
            min={0.1}
            max={Math.max(0.1, usdcBalance)}
            step={0.1}
            value={feedAmount}
            onChange={(e) => setFeedAmount(Math.max(0.1, Number(e.target.value)))}
            className="w-full bg-gray-800 text-white rounded px-3 py-1.5 text-sm mb-2 border border-gray-700 focus:outline-none focus:border-pink-400"
          />
          <p className="text-xs text-gray-500 mb-3">
            +{Math.floor(feedAmount) * 10} hambre · +{Math.floor(feedAmount) * 100} XP
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleFeedConfirm}
              disabled={loading || feedAmount < 0.1}
              className="btn-pink flex-1 text-xs py-2"
            >
              Confirmar
            </button>
            <button
              onClick={() => setShowFeed(false)}
              className="btn-outline flex-1 text-xs py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => setShowFeed(true)}
            disabled={loading}
            className="btn-pink flex-1 text-xs py-3"
          >
            🍖 Alimentar
          </button>
          <button
            onClick={() => onPlay(pet.name)}
            disabled={loading || !playReady}
            title={!playReady ? `Disponible en ${cooldownHours}h` : ""}
            className={`flex-1 text-xs py-3 ${
              playReady ? "btn-purple" : "btn-disabled"
            }`}
          >
            {playReady ? "🎮 Jugar" : `⏳ ${cooldownHours}h`}
          </button>
        </div>
      )}
    </div>
  );
}
