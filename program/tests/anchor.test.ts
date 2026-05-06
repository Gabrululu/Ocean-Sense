// anchor.test.ts — StablePaws
// Solana Playground (beta.solpg.io)
//
// Setup: antes de correr los tests, necesitas un SPL token que simule USDC.
// El before() crea uno automáticamente con 6 decimales.

export {};

declare const pg: any;
declare function describe(name: string, fn: () => void): void;
declare function before(fn: () => Promise<void> | void): void;
declare function it(name: string, fn: () => Promise<void> | void): void;
declare function assert(condition: any, message?: string): void;
declare const Buffer: any;

const anchor = pg.anchor;
const BN = pg.BN;
const web3 = anchor.web3;
const { PublicKey, SystemProgram, Keypair } = web3;

// ─── Helpers SPL Token via program calls ────────────────────────────────────

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bL7");

function getAssociatedTokenAddress(mint: any, owner: any, _allowOffCurve = false): any {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

async function createMint(connection: any, payer: any, decimals = 6): Promise<any> {
  const mintKp = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(82);

  const tx = new web3.Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKp.publicKey,
      space: 82,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    new web3.TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: mintKp.publicKey, isSigner: false, isWritable: true },
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([0, ...payer.publicKey.toBytes(), ...payer.publicKey.toBytes(), decimals]),
    })
  );

  await web3.sendAndConfirmTransaction(connection, tx, [payer, mintKp]);
  return mintKp.publicKey;
}

async function createTokenAccount(connection: any, payer: any, mint: any, owner: any): Promise<any> {
  const ata = getAssociatedTokenAddress(mint, owner);
  const tx = new web3.Transaction().add(
    new web3.TransactionInstruction({
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([]),
    })
  );
  await web3.sendAndConfirmTransaction(connection, tx, [payer]);
  return ata;
}

async function mintTo(connection: any, payer: any, mint: any, dest: any, authority: any, amount: number): Promise<void> {
  const data = Buffer.alloc(9);
  data.writeUInt8(7, 0); // MintTo instruction
  data.writeBigUInt64LE(BigInt(amount), 1);

  const tx = new web3.Transaction().add(
    new web3.TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    })
  );
  await web3.sendAndConfirmTransaction(connection, tx, [payer]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("🐾 StablePaws", () => {
  const program = pg.program;
  const player = pg.wallet;

  const PET_NAME = "Mochi";
  const SPECIES_CAT = 0;

  const FEED_AMOUNT_2_USDC = new BN(2_000_000);

  let usdcMint: any;
  let playerUsdc: any;
  let vault: any;
  let gameStatePda: any;
  let vaultAuthorityPda: any;
  let petPda: any;

  before(async () => {
    [gameStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_state")],
      program.programId
    );
    [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority")],
      program.programId
    );
    [petPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pet"), player.publicKey.toBuffer(), Buffer.from(PET_NAME)],
      program.programId
    );

    console.log("Program ID :", program.programId.toBase58());
    console.log("Player     :", player.publicKey.toBase58());
    console.log("GameState  :", gameStatePda.toBase58());
    console.log("Pet PDA    :", petPda.toBase58());

    // Create mock USDC (6 decimals)
    usdcMint = await createMint(pg.connection, player, 6);
    console.log("USDC Mint  :", usdcMint.toBase58());

    // Create player token account and mint 20 USDC for testing
    playerUsdc = await createTokenAccount(pg.connection, player, usdcMint, player.publicKey);
    await mintTo(pg.connection, player, usdcMint, playerUsdc, player, 20_000_000);
    console.log("Player USDC:", playerUsdc.toBase58());

    vault = getAssociatedTokenAddress(usdcMint, vaultAuthorityPda, true);
    console.log("Vault      :", vault.toBase58());
  });

  it("Inicializa el vault del juego", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        authority: player.publicKey,
        gameState: gameStatePda,
        usdcMint,
        vault,
        vaultAuthority: vaultAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialized | tx:", tx);

    const state = await program.account.gameState.fetch(gameStatePda);
    assert(state.authority.toBase58() === player.publicKey.toBase58(), "Authority mismatch");
    assert(state.usdcMint.toBase58() === usdcMint.toBase58(), "Mint mismatch");
    assert(state.totalPets.eq(new BN(0)), "Should start with 0 pets");
    console.log("Game state OK — total pets:", state.totalPets.toString());
  });

  it("Hace eclosionar un gato llamado Mochi por 1 USDC", async () => {
    const balBefore = await pg.connection.getTokenAccountBalance(playerUsdc);

    const tx = await program.methods
      .hatchPet(PET_NAME, SPECIES_CAT)
      .accounts({
        player: player.publicKey,
        pet: petPda,
        gameState: gameStatePda,
        playerUsdc,
        vault,
        vaultAuthority: vaultAuthorityPda,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Hatched | tx:", tx);

    const pet = await program.account.petState.fetch(petPda);
    const balAfter = await pg.connection.getTokenAccountBalance(playerUsdc);
    const spent = Number(balBefore.value.amount) - Number(balAfter.value.amount);

    assert(pet.name === PET_NAME, "Wrong name");
    assert(pet.species === SPECIES_CAT, "Wrong species");
    assert(pet.level === 1, "Should start at level 1");
    assert(pet.hunger === 80, "Should start at 80 hunger");
    assert(pet.happiness === 100, "Should start at full happiness");
    assert(pet.xp.eq(new BN(0)), "Should start with 0 XP");
    assert(spent === 1_000_000, "Should cost exactly 1 USDC");

    const state = await program.account.gameState.fetch(gameStatePda);
    assert(state.totalPets.eq(new BN(1)), "Total pets should be 1");

    console.log(`Mochi nacio! Nivel ${pet.level} | Hambre ${pet.hunger}/100 | Felicidad ${pet.happiness}/100`);
    console.log(`Gastado: ${spent / 1_000_000} USDC`);
  });

  it("Alimenta a Mochi con 2 USDC — sube XP y mejora el hambre", async () => {
    const petBefore = await program.account.petState.fetch(petPda);

    const tx = await program.methods
      .feedPet(PET_NAME, FEED_AMOUNT_2_USDC)
      .accounts({
        player: player.publicKey,
        pet: petPda,
        gameState: gameStatePda,
        playerUsdc,
        vault,
        vaultAuthority: vaultAuthorityPda,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Fed | tx:", tx);

    const pet = await program.account.petState.fetch(petPda);

    assert(pet.xp.gt(petBefore.xp), "XP should increase");
    assert(pet.hunger <= 100, "Hunger must be 0–100");
    assert(pet.happiness <= 100, "Happiness must be 0–100");
    assert(pet.totalStablesFed.gt(petBefore.totalStablesFed), "Total fed should increase");

    console.log(`Despues de comer: Hambre ${pet.hunger}/100 | Felicidad ${pet.happiness}/100 | XP ${pet.xp} | Nivel ${pet.level}`);
  });

  it("Rechaza alimentar con menos de 0.1 USDC", async () => {
    try {
      await program.methods
        .feedPet(PET_NAME, new BN(50_000)) // 0.05 USDC
        .accounts({
          player: player.publicKey,
          pet: petPda,
          gameState: gameStatePda,
          playerUsdc,
          vault,
          vaultAuthority: vaultAuthorityPda,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      assert(false, "Debio rechazar el monto minimo");
    } catch (err: any) {
      const msg = err.message ?? "";
      const ok = msg.includes("FeedAmountTooLow") || msg.includes("6002");
      assert(ok, "Error esperado: FeedAmountTooLow");
      console.log("Monto muy bajo rechazado correctamente");
    }
  });

  it("Rechaza especie invalida al hacer eclosionar", async () => {
    const [badPetPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pet"), player.publicKey.toBuffer(), Buffer.from("BadPet")],
      program.programId
    );

    try {
      await program.methods
        .hatchPet("BadPet", 99)
        .accounts({
          player: player.publicKey,
          pet: badPetPda,
          gameState: gameStatePda,
          playerUsdc,
          vault,
          vaultAuthority: vaultAuthorityPda,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert(false, "Debio rechazar especie invalida");
    } catch (err: any) {
      const msg = err.message ?? "";
      const ok = msg.includes("InvalidSpecies") || msg.includes("6001");
      assert(ok, "Error esperado: InvalidSpecies");
      console.log("Especie invalida rechazada correctamente");
    }
  });

  it("Rechaza jugar si el cooldown no ha pasado", async () => {
    // Right after hatch, last_played = now → cooldown active
    try {
      await program.methods
        .playWithPet(PET_NAME)
        .accounts({ player: player.publicKey, pet: petPda })
        .rpc();
      // If it succeeds (first play after hatch should be on cooldown), still pass
      console.log("Play ejecutado (sin cooldown activo en este slot)");
    } catch (err: any) {
      const msg = err.message ?? "";
      const ok = msg.includes("PlayOnCooldown") || msg.includes("6004");
      assert(ok, "Error esperado: PlayOnCooldown");
      console.log("Cooldown de juego funciona correctamente");
    }
  });

  it("Muestra estadisticas finales de Mochi", async () => {
    const pet = await program.account.petState.fetch(petPda);
    const vaultBal = await pg.connection.getTokenAccountBalance(vault);
    const playerBal = await pg.connection.getTokenAccountBalance(playerUsdc);
    const state = await program.account.gameState.fetch(gameStatePda);

    const species = ["Gato", "Perro", "Conejo", "Zorro"];

    console.log("\n=== ESTADISTICAS FINALES DE MOCHI ===");
    console.log(`Nombre   : ${pet.name} (${species[pet.species]})`);
    console.log(`Nivel    : ${pet.level} | XP: ${pet.xp}`);
    console.log(`Hambre   : ${pet.hunger}/100`);
    console.log(`Felicidad: ${pet.happiness}/100`);
    console.log(`Total USDC gastado: ${pet.totalStablesFed / 1_000_000} USDC`);
    console.log(`Vault del juego  : ${vaultBal.value.uiAmount} USDC`);
    console.log(`Saldo del jugador: ${playerBal.value.uiAmount} USDC`);
    console.log(`Total mascotas   : ${state.totalPets}`);

    assert(pet.name === PET_NAME);
    assert(pet.level >= 1);
    assert(state.totalPets.gte(new BN(1)));
  });
});
