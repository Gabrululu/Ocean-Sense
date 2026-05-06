// IDL generado a partir del programa Anchor de StablePaws.
// Discriminators calculados con sha256("global:<name>") y sha256("account:<Name>").

export const IDL = {
  address: "StPwsXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX11",
  metadata: { name: "stable_paws", version: "0.1.0", spec: "0.1.0" },
  instructions: [
    {
      name: "initialize",
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "gameState", writable: true },
        { name: "usdcMint" },
        { name: "vault", writable: true },
        { name: "vaultAuthority" },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
        { name: "systemProgram" },
      ],
      args: [],
    },
    {
      name: "hatchPet",
      discriminator: [163, 9, 80, 199, 119, 91, 244, 69],
      accounts: [
        { name: "player", writable: true, signer: true },
        { name: "pet", writable: true },
        { name: "gameState", writable: true },
        { name: "playerUsdc", writable: true },
        { name: "vault", writable: true },
        { name: "vaultAuthority" },
        { name: "usdcMint" },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
        { name: "systemProgram" },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "species", type: "u8" },
      ],
    },
    {
      name: "feedPet",
      discriminator: [178, 186, 190, 67, 17, 33, 124, 31],
      accounts: [
        { name: "player", writable: true, signer: true },
        { name: "pet", writable: true },
        { name: "gameState" },
        { name: "playerUsdc", writable: true },
        { name: "vault", writable: true },
        { name: "vaultAuthority" },
        { name: "usdcMint" },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "usdcAmount", type: "u64" },
      ],
    },
    {
      name: "playWithPet",
      discriminator: [216, 101, 95, 96, 167, 216, 238, 155],
      accounts: [
        { name: "player", writable: true, signer: true },
        { name: "pet", writable: true },
      ],
      args: [{ name: "name", type: "string" }],
    },
  ],
  accounts: [
    {
      name: "GameState",
      discriminator: [144, 94, 208, 172, 248, 99, 134, 120],
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "usdcMint", type: "pubkey" },
          { name: "totalPets", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "PetState",
      discriminator: [185, 184, 195, 157, 163, 163, 6, 37],
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "name", type: "string" },
          { name: "species", type: "u8" },
          { name: "level", type: "u8" },
          { name: "hunger", type: "u8" },
          { name: "happiness", type: "u8" },
          { name: "xp", type: "u64" },
          { name: "lastFed", type: "i64" },
          { name: "lastPlayed", type: "i64" },
          { name: "totalStablesFed", type: "u64" },
          { name: "birthSlot", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "InvalidName",      msg: "Name must be between 1 and 32 characters" },
    { code: 6001, name: "InvalidSpecies",   msg: "Species must be 0-3" },
    { code: 6002, name: "FeedAmountTooLow", msg: "Feed amount must be at least 0.1 USDC" },
    { code: 6003, name: "NotOwner",         msg: "Only the pet owner can do this" },
    { code: 6004, name: "PlayOnCooldown",   msg: "Your pet needs rest! Play again in 8 hours" },
  ],
} as const;

export type StablePawsIDL = typeof IDL;
