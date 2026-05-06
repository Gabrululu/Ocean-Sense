// client.ts — StablePaws
// Solana Playground (beta.solpg.io)
// Reemplaza USDC_MINT con la dirección de tu mint en devnet.

export {};

declare const pg: any;
declare const Buffer: any;

const anchor = pg.anchor;
const BN = pg.BN;
const { PublicKey, SystemProgram } = anchor.web3;

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bL7");

// ─── Config ──────────────────────────────────────────────────────────────────

const USDC_MINT = new PublicKey("REPLACE_WITH_YOUR_USDC_MINT_ADDRESS");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAssociatedTokenAddress(mint: any, owner: any, _allowOffCurve = false): any {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

function deriveGameState(programId: any): any {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("game_state")], programId);
  return pda;
}

function deriveVaultAuthority(programId: any): any {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("vault_authority")], programId);
  return pda;
}

function derivePetPda(programId: any, owner: any, petName: string): any {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pet"), owner.toBuffer(), Buffer.from(petName)],
    programId
  );
  return pda;
}

function speciesEmoji(species: number): string {
  return ["🐱", "🐶", "🐰", "🦊"][species] ?? "?";
}

function moodLabel(hunger: number, happiness: number): string {
  if (hunger < 20) return "😵 Hambriento";
  if (happiness < 30) return "😢 Triste";
  if (hunger >= 70 && happiness >= 70) return "🤩 Extático";
  return "😊 Feliz";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const program = pg.program;
  const player = pg.wallet;

  console.log("=== StablePaws Client ===");
  console.log("Wallet  :", player.publicKey.toBase58());
  console.log("Program :", program.programId.toBase58());

  const gameStatePda = deriveGameState(program.programId);
  const vaultAuthority = deriveVaultAuthority(program.programId);
  const vault = getAssociatedTokenAddress(USDC_MINT, vaultAuthority, true);
  const playerUsdc = getAssociatedTokenAddress(USDC_MINT, player.publicKey);

  // ── Leer estado del juego ──────────────────────────────────────────────────
  let gameState: any;
  try {
    gameState = await program.account.gameState.fetch(gameStatePda);
    console.log("\nJuego inicializado");
    console.log("Total mascotas:", gameState.totalPets.toString());
  } catch {
    console.log("\nJuego no inicializado. Ejecuta initialize() primero.");

    const tx = await program.methods
      .initialize()
      .accounts({
        authority: player.publicKey,
        gameState: gameStatePda,
        usdcMint: USDC_MINT,
        vault,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Vault creado | tx:", tx);
    gameState = await program.account.gameState.fetch(gameStatePda);
  }

  // ── Mostrar saldo USDC del jugador ─────────────────────────────────────────
  try {
    const bal = await pg.connection.getTokenAccountBalance(playerUsdc);
    console.log("Tu saldo USDC:", bal.value.uiAmount, "USDC");
  } catch {
    console.log("No se encontro cuenta USDC. Crea una con spl-token create-account.");
  }

  // ── Demo: hacer eclosionar y mostrar mascota ───────────────────────────────
  const PET_NAME = "Mochi";
  const petPda = derivePetPda(program.programId, player.publicKey, PET_NAME);

  let pet: any;
  try {
    pet = await program.account.petState.fetch(petPda);
    console.log(`\nMascota encontrada: ${speciesEmoji(pet.species)} ${pet.name}`);
  } catch {
    console.log(`\nHaciendo eclosionar a ${PET_NAME}...`);

    const tx = await program.methods
      .hatchPet(PET_NAME, 0) // 0 = gato
      .accounts({
        player: player.publicKey,
        pet: petPda,
        gameState: gameStatePda,
        playerUsdc,
        vault,
        vaultAuthority,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Nacio | tx:", tx);
    pet = await program.account.petState.fetch(petPda);
  }

  // ── Mostrar estado actual de la mascota ────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const hoursHungry = Math.floor((now - pet.lastFed.toNumber()) / 3600);
  const estHunger = Math.max(0, pet.hunger - hoursHungry * 4);

  console.log("\n=== ESTADO ACTUAL ===");
  console.log(`${speciesEmoji(pet.species)} ${pet.name}`);
  console.log(`Nivel      : ${pet.level} | XP: ${pet.xp}`);
  console.log(`Hambre est.: ${estHunger}/100 (${hoursHungry}h sin comer)`);
  console.log(`Felicidad  : ${pet.happiness}/100`);
  console.log(`Estado     : ${moodLabel(estHunger, pet.happiness)}`);
  console.log(`USDC gastado total: ${pet.totalStablesFed / 1_000_000} USDC`);

  // ── Alimentar si tiene hambre ──────────────────────────────────────────────
  if (estHunger < 50) {
    console.log("\nMochi tiene hambre! Alimentando con 1 USDC...");
    const tx = await program.methods
      .feedPet(PET_NAME, new BN(1_000_000))
      .accounts({
        player: player.publicKey,
        pet: petPda,
        gameState: gameStatePda,
        playerUsdc,
        vault,
        vaultAuthority,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Alimentado | tx:", tx);
    const updated = await program.account.petState.fetch(petPda);
    console.log(`Nuevo hambre: ${updated.hunger}/100`);
  } else {
    console.log("\nMochi esta bien alimentado");
  }
}

main().catch(console.error);
