import { PublicKey } from "@solana/web3.js";

// ── Actualiza PROGRAM_ID después de hacer deploy en Playground ──────────────
export const PROGRAM_ID = new PublicKey(
  "StPwsXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX11"
);

// ── Actualiza USDC_MINT con tu mint de prueba en Devnet ─────────────────────
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC mainnet como placeholder
);

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bL7"
);

export const HATCH_COST_USDC = 1_000_000;  // 1 USDC
export const MIN_FEED_USDC   = 100_000;    // 0.1 USDC
export const HUNGER_PER_HOUR = 4;
export const PLAY_COOLDOWN_MS = 8 * 3600 * 1000;

export const SPECIES = [
  { id: 0, name: "Gato",   emoji: "🐱" },
  { id: 1, name: "Perro",  emoji: "🐶" },
  { id: 2, name: "Conejo", emoji: "🐰" },
  { id: 3, name: "Zorro",  emoji: "🦊" },
] as const;
