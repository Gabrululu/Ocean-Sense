// Client (Solana Playground)

export {};

declare const pg: any;
declare const web3: any;

async function main() {
  console.log("My address:", pg.wallet.publicKey.toString());
  const balance = await pg.connection.getBalance(pg.wallet.publicKey);
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
}

main().catch((err) => {
  console.error(err);
});