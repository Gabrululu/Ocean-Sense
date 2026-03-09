// anchor.test.ts — Ocean-Sense Network
// Solana Playground (beta.solpg.io)

export {};

declare const pg: any;
declare function describe(name: string, fn: () => void): void;
declare function before(fn: () => Promise<void> | void): void;
declare function it(name: string, fn: () => Promise<void> | void): void;
declare function assert(condition: any, message?: string): void;
declare const Buffer: any;

const anchor = pg.anchor;
const BN = pg.BN;

describe("Ocean-Sense Network", () => {
	const program = pg.program;
	const operator = pg.wallet;

	const BUOY_ID = "PAITA-001";
	const LAT = new BN(-506200); // -5.062° Paita, Piura
	const LNG = new BN(-8143000); // -81.430°
	const BUOY_NAME = "Boya Paita Norte - Piura";

	let buoyPda: any;

	before(async () => {
		[buoyPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[
				Buffer.from("buoy"),
				Buffer.from(BUOY_ID),
				operator.publicKey.toBuffer(),
			],
			program.programId
		);
		console.log("Program ID:", program.programId.toBase58());
		console.log("Operator:", operator.publicKey.toBase58());
		console.log("Buoy PDA:", buoyPda.toBase58());
	});

	it("Registra una boya en el litoral peruano", async () => {
		const tx = await program.methods
			.registerBuoy(BUOY_ID, LAT, LNG, BUOY_NAME)
			.accounts({
				buoy: buoyPda,
				operator: operator.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.rpc();

		console.log("Boya registrada | tx:", tx);

		const acct = await program.account.buoyState.fetch(buoyPda);
		console.log("ID:", acct.buoyId);
		console.log("Nombre:", acct.locationName);
		console.log("Activa:", acct.isActive);

		assert(acct.buoyId === BUOY_ID);
		assert(acct.isActive === true);
		assert(acct.totalReadings.eq(new BN(0)));
	});

	it("Envia una lectura oceanica (agua limpia)", async () => {
		const idx = new BN(0);
		const [readingPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[
				Buffer.from("reading"),
				buoyPda.toBuffer(),
				idx.toArrayLike(Buffer, "le", 8),
			],
			program.programId
		);

		const ts = new BN(Math.floor(Date.now() / 1000));

		const tx = await program.methods
			.submitReading(2250, 3510, 85, 0, ts)
			.accounts({
				buoy: buoyPda,
				reading: readingPda,
				operator: operator.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.rpc();

		console.log("Lectura enviada | tx:", tx);

		const r = await program.account.oceanReading.fetch(readingPda);
		assert(r.pollutionLevel === 0);
		assert(r.rewardLamports.eq(new BN(1_000_000)));

		const buoy = await program.account.buoyState.fetch(buoyPda);
		assert(buoy.totalReadings.eq(new BN(1)));
	});

	it("Detecta contaminacion critica y da mayor recompensa", async () => {
		const idx = new BN(1);
		const [alertPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[
				Buffer.from("reading"),
				buoyPda.toBuffer(),
				idx.toArrayLike(Buffer, "le", 8),
			],
			program.programId
		);

		const ts = new BN(Math.floor(Date.now() / 1000));

		const tx = await program.methods
			.submitReading(1820, 3380, 210, 3, ts)
			.accounts({
				buoy: buoyPda,
				reading: alertPda,
				operator: operator.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.rpc();

		console.log("Alerta critica | tx:", tx);

		const r = await program.account.oceanReading.fetch(alertPda);
		assert(r.pollutionLevel === 3);
		assert(r.rewardLamports.eq(new BN(5_000_000)));
	});

	it("Desactiva la boya (mantenimiento)", async () => {
		await program.methods
			.toggleBuoy(false)
			.accounts({ buoy: buoyPda, operator: operator.publicKey })
			.rpc();

		const acct = await program.account.buoyState.fetch(buoyPda);
		assert(acct.isActive === false);
	});

	it("Rechaza lecturas cuando la boya esta inactiva", async () => {
		const idx = new BN(2);
		const [failPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[
				Buffer.from("reading"),
				buoyPda.toBuffer(),
				idx.toArrayLike(Buffer, "le", 8),
			],
			program.programId
		);

		try {
			await program.methods
				.submitReading(2100, 3500, 70, 0, new BN(Math.floor(Date.now() / 1000)))
				.accounts({
					buoy: buoyPda,
					reading: failPda,
					operator: operator.publicKey,
					systemProgram: anchor.web3.SystemProgram.programId,
				})
				.rpc();
			assert(false, "Debio fallar con boya inactiva");
		} catch (err: any) {
			const msg: string = err.message ?? "";
			const ok = msg.includes("BuoyNotActive") || msg.includes("6002");
			assert(ok);
		}
	});

	it("Reactiva la boya y muestra estadisticas finales", async () => {
		await program.methods
			.toggleBuoy(true)
			.accounts({ buoy: buoyPda, operator: operator.publicKey })
			.rpc();

		const acct = await program.account.buoyState.fetch(buoyPda);
		assert(acct.isActive === true);

		console.log("ESTADISTICAS FINALES:");
		console.log("ID:", acct.buoyId);
		console.log("Nombre:", acct.locationName);
		console.log("Total lecturas:", acct.totalReadings.toString());
		console.log("Recompensas:", acct.totalRewards.toString(), "lamports");
		console.log("Estado: ACTIVA");
	});
});