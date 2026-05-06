import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useStablePaws } from "./hooks/useStablePaws";
import { PetCard } from "./components/PetCard";
import { HatchModal } from "./components/HatchModal";

export function App() {
  const { publicKey } = useWallet();
  const {
    pet,
    gameState,
    usdcBalance,
    loading,
    txError,
    initialize,
    hatchPet,
    feedPet,
    playWithPet,
    loadPet,
    clearError,
  } = useStablePaws();

  const [showHatch, setShowHatch] = useState(false);
  const [searchName, setSearchName] = useState("");

  async function handleHatch(name: string, species: number) {
    await hatchPet(name, species);
    setShowHatch(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-[#3d2062] px-4 py-3 flex items-center justify-between">
        <div>
          <span className="pixel-text text-pink-300 text-xs">StablePaws</span>
          <span className="ml-2 text-lg">🐾</span>
        </div>
        <div className="flex items-center gap-3">
          {publicKey && (
            <span className="text-xs text-gray-400 font-mono hidden sm:block">
              {usdcBalance.toFixed(2)} USDC
            </span>
          )}
          <WalletMultiButton />
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">

        {/* Not connected */}
        {!publicKey && (
          <div className="text-center max-w-sm">
            <div className="text-7xl mb-6 animate-bounce-slow">🥚</div>
            <h1 className="pixel-text text-pink-300 text-base mb-3 leading-relaxed">
              StablePaws
            </h1>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              Cría mascotas adorables on-chain.<br />
              Aliméntalas con USDC. Hazlas crecer.
            </p>
            <WalletMultiButton />
          </div>
        )}

        {/* Connected */}
        {publicKey && (
          <div className="w-full max-w-sm flex flex-col gap-4">

            {/* Error banner */}
            {txError && (
              <div className="pixel-border bg-red-950 text-red-300 text-xs p-3 rounded flex justify-between items-start gap-2">
                <span className="font-mono leading-relaxed">{txError}</span>
                <button onClick={clearError} className="text-red-400 hover:text-white shrink-0">✕</button>
              </div>
            )}

            {/* Game not initialized */}
            {!gameState && (
              <div className="pixel-card p-5 text-center">
                <p className="text-gray-300 text-sm mb-4">
                  El juego aún no está inicializado en Devnet.
                </p>
                <button
                  onClick={initialize}
                  disabled={loading}
                  className="btn-purple text-xs px-6 py-3"
                >
                  {loading ? "Inicializando…" : "Inicializar Vault"}
                </button>
              </div>
            )}

            {/* Has pet */}
            {gameState && pet && (
              <PetCard
                pet={pet}
                usdcBalance={usdcBalance}
                loading={loading}
                onFeed={feedPet}
                onPlay={playWithPet}
              />
            )}

            {/* No pet — show options */}
            {gameState && !pet && (
              <div className="pixel-card p-6 text-center">
                <div className="text-6xl mb-4 animate-bounce-slow">🥚</div>
                <h2 className="pixel-text text-pink-300 text-xs mb-2">
                  Sin mascota
                </h2>
                <p className="text-gray-400 text-xs mb-5 leading-relaxed">
                  Haz eclosionar tu primera mascota por 1 USDC, <br />
                  o carga una existente.
                </p>
                <button
                  onClick={() => setShowHatch(true)}
                  disabled={loading || usdcBalance < 1}
                  className="btn-pink w-full py-3 text-xs mb-3"
                >
                  🐣 Hacer Eclosionar (1 USDC)
                </button>

                {/* Load existing */}
                <div className="flex gap-2 mt-1">
                  <input
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="nombre de mascota…"
                    className="flex-1 bg-gray-800 text-white text-xs rounded px-3 py-2 border border-gray-700 focus:outline-none focus:border-pink-400"
                    onKeyDown={(e) => e.key === "Enter" && loadPet(searchName)}
                  />
                  <button
                    onClick={() => loadPet(searchName)}
                    className="btn-outline text-xs px-3 py-2"
                  >
                    Cargar
                  </button>
                </div>
              </div>
            )}

            {/* Global stats */}
            {gameState && (
              <div className="text-center text-xs text-gray-600 font-mono">
                {gameState.totalPets.toString()} mascotas viven on-chain
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="text-center text-xs text-gray-700 py-4 font-mono">
        StablePaws · Solana Devnet · Anchor 0.30
      </footer>

      {/* ── Hatch Modal ── */}
      {showHatch && (
        <HatchModal
          usdcBalance={usdcBalance}
          loading={loading}
          onHatch={handleHatch}
          onClose={() => setShowHatch(false)}
        />
      )}
    </div>
  );
}
