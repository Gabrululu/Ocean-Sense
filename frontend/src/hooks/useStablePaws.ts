import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN, type Idl } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { IDL } from "../idl";
import {
  PROGRAM_ID,
  USDC_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  HATCH_COST_USDC,
  HUNGER_PER_HOUR,
  PLAY_COOLDOWN_MS,
} from "../constants";

export interface PetAccount {
  owner: PublicKey;
  name: string;
  species: number;
  level: number;
  hunger: number;
  happiness: number;
  xp: BN;
  lastFed: BN;
  lastPlayed: BN;
  totalStablesFed: BN;
  birthSlot: BN;
  bump: number;
}

export interface GameStateAccount {
  authority: PublicKey;
  usdcMint: PublicKey;
  totalPets: BN;
  bump: number;
}

// Use `any` to bypass Anchor's strict readonly IDL type constraints at compile time
type AnyProgram = Program<Idl>;

function derivePetPda(owner: PublicKey, name: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pet"), owner.toBuffer(), Buffer.from(name)],
    PROGRAM_ID
  );
  return pda;
}

function deriveGameStatePda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_state")],
    PROGRAM_ID
  );
  return pda;
}

function deriveVaultAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    PROGRAM_ID
  );
  return pda;
}

export function computeCurrentHunger(pet: PetAccount): number {
  const now = Math.floor(Date.now() / 1000);
  const lastFed = pet.lastFed.toNumber();
  const hoursElapsed = Math.floor((now - lastFed) / 3600);
  return Math.max(0, pet.hunger - hoursElapsed * HUNGER_PER_HOUR);
}

export function computePlayCooldownMs(pet: PetAccount): number {
  const now = Date.now();
  const lastPlayedMs = pet.lastPlayed.toNumber() * 1000;
  return Math.max(0, PLAY_COOLDOWN_MS - (now - lastPlayedMs));
}

export function useStablePaws() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [program, setProgram] = useState<AnyProgram | null>(null);
  const [pet, setPet] = useState<PetAccount | null>(null);
  const [gameState, setGameState] = useState<GameStateAccount | null>(null);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [petName, setPetName] = useState("");

  useEffect(() => {
    if (!wallet.publicKey) { setProgram(null); return; }
    const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
    setProgram(new Program(IDL as unknown as Idl, provider));
  }, [connection, wallet.publicKey]);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey || !program) return;

    try {
      const gs = await (program as any).account.gameState.fetch(deriveGameStatePda());
      setGameState(gs as GameStateAccount);
    } catch { /* not initialized */ }

    try {
      const ata = getAssociatedTokenAddressSync(USDC_MINT, wallet.publicKey);
      const bal = await connection.getTokenAccountBalance(ata);
      setUsdcBalance(bal.value.uiAmount ?? 0);
    } catch { setUsdcBalance(0); }

    if (petName) {
      try {
        const pda = derivePetPda(wallet.publicKey, petName);
        const p = await (program as any).account.petState.fetch(pda);
        setPet(p as PetAccount);
      } catch { setPet(null); }
    }
  }, [program, wallet.publicKey, connection, petName]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const loadPet = useCallback(async (name: string) => {
    if (!wallet.publicKey || !program) return;
    setPetName(name);
    try {
      const p = await (program as any).account.petState.fetch(derivePetPda(wallet.publicKey, name));
      setPet(p as PetAccount);
    } catch { setPet(null); }
  }, [wallet.publicKey, program]);

  const initialize = useCallback(async () => {
    if (!wallet.publicKey || !program) return;
    setLoading(true); setTxError(null);
    try {
      const vaultAuthority = deriveVaultAuthority();
      const vault = getAssociatedTokenAddressSync(USDC_MINT, vaultAuthority, true);
      await (program as any).methods.initialize().accounts({
        authority: wallet.publicKey,
        gameState: deriveGameStatePda(),
        usdcMint: USDC_MINT,
        vault,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).rpc();
      await refresh();
    } catch (e: any) { setTxError(e.message); }
    finally { setLoading(false); }
  }, [program, wallet.publicKey, refresh]);

  const hatchPet = useCallback(async (name: string, species: number) => {
    if (!wallet.publicKey || !program) return;
    setLoading(true); setTxError(null);
    try {
      const vaultAuthority = deriveVaultAuthority();
      const vault = getAssociatedTokenAddressSync(USDC_MINT, vaultAuthority, true);
      const playerUsdc = getAssociatedTokenAddressSync(USDC_MINT, wallet.publicKey);
      await (program as any).methods.hatchPet(name, species).accounts({
        player: wallet.publicKey,
        pet: derivePetPda(wallet.publicKey, name),
        gameState: deriveGameStatePda(),
        playerUsdc,
        vault,
        vaultAuthority,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).rpc();
      setPetName(name);
      const p = await (program as any).account.petState.fetch(derivePetPda(wallet.publicKey, name));
      setPet(p as PetAccount);
      await refresh();
    } catch (e: any) { setTxError(e.message); }
    finally { setLoading(false); }
  }, [program, wallet.publicKey, refresh]);

  const feedPet = useCallback(async (name: string, usdcAmount: number) => {
    if (!wallet.publicKey || !program) return;
    setLoading(true); setTxError(null);
    try {
      const vaultAuthority = deriveVaultAuthority();
      const vault = getAssociatedTokenAddressSync(USDC_MINT, vaultAuthority, true);
      const playerUsdc = getAssociatedTokenAddressSync(USDC_MINT, wallet.publicKey);
      await (program as any).methods.feedPet(name, new BN(usdcAmount)).accounts({
        player: wallet.publicKey,
        pet: derivePetPda(wallet.publicKey, name),
        gameState: deriveGameStatePda(),
        playerUsdc,
        vault,
        vaultAuthority,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      }).rpc();
      const p = await (program as any).account.petState.fetch(derivePetPda(wallet.publicKey, name));
      setPet(p as PetAccount);
      await refresh();
    } catch (e: any) { setTxError(e.message); }
    finally { setLoading(false); }
  }, [program, wallet.publicKey, refresh]);

  const playWithPet = useCallback(async (name: string) => {
    if (!wallet.publicKey || !program) return;
    setLoading(true); setTxError(null);
    try {
      await (program as any).methods.playWithPet(name).accounts({
        player: wallet.publicKey,
        pet: derivePetPda(wallet.publicKey, name),
      }).rpc();
      const p = await (program as any).account.petState.fetch(derivePetPda(wallet.publicKey, name));
      setPet(p as PetAccount);
      await refresh();
    } catch (e: any) { setTxError(e.message); }
    finally { setLoading(false); }
  }, [program, wallet.publicKey, refresh]);

  return {
    program,
    pet,
    petName,
    gameState,
    usdcBalance,
    loading,
    txError,
    hatchCostUsdc: HATCH_COST_USDC / 1_000_000,
    loadPet,
    initialize,
    hatchPet,
    feedPet,
    playWithPet,
    refresh,
    clearError: () => setTxError(null),
  };
}
