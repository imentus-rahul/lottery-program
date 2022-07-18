import * as anchor from "@project-serum/anchor";
import * as splToken from "../node_modules/@solana/spl-token";
import * as mplMd from "@metaplex-foundation/mpl-token-metadata";
import * as sb from "@switchboard-xyz/switchboard-v2";
import * as sbUtils from "@switchboard-xyz/sbv2-utils";
import { Program } from "@project-serum/anchor";
import { SolanaLotteryProgram } from "../target/types/solana_lottery_program";

describe("solana-lottery-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .SolanaLotteryProgram as Program<SolanaLotteryProgram>;

  const wallet = (program.provider as anchor.AnchorProvider).wallet;

  it("init lottery", async () => {
    // seed wallet with lamports
    await getLamports(program.provider.connection, wallet.publicKey)

    // init payer
    const payer = anchor.web3.Keypair.generate();
    await getLamports(program.provider.connection, payer.publicKey);

    // init both mints and make the payer the authority
    const purchaseMint = await splToken.createMint(
      program.provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    // mock NFT
    const prizeMint = await splToken.createMint(
      program.provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      0
    );

    // create admin ATA and mint the prize so the admin can transfer to the lottery program on init
    const adminPrizeAta = await splToken.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      prizeMint,
      wallet.publicKey
    );
    await splToken.mintTo(
      program.provider.connection,
      payer,
      prizeMint,
      adminPrizeAta.address,
      payer.publicKey,
      1
    );

    console.log("payer & mints created");

    const lotteryName = "test-lottery";

    // create lottery pdas
    const [purchaseVault, _purchaseVaultBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("purchase_vault"), Buffer.from(lotteryName)],
        program.programId
      );
    const [prizeVault, _prizeVaultBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("prize_vault"), Buffer.from(lotteryName)],
        program.programId
      );
    const [lotteryManager, _lotteryManagerBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_manager"), Buffer.from(lotteryName)],
        program.programId
      );

    // metaplex collection accounts
    const [collectionMint, _collectionMintBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("collection_mint"), Buffer.from(lotteryName)],
        program.programId
      );

    const [collectionAta, _collectionAtaBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [collectionMint.toBuffer()],
        program.programId
      );

    // metadata
    let [collectionMd, _collectionMdBump] =
      await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          mplMd.PROGRAM_ID.toBuffer(),
          collectionMint.toBuffer(),
        ],
        mplMd.PROGRAM_ID
      );
    // master edition
    let [collectionMe, _collectionMeBump] =
      await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          mplMd.PROGRAM_ID.toBuffer(),
          collectionMint.toBuffer(),
          Buffer.from("edition"),
        ],
        mplMd.PROGRAM_ID
      );
    console.log("lottery & metaplex PDA's generated");

    // switchboard VRF

    // init switchboard client
    const sbProgram = await sb.loadSwitchboardProgram(
      "devnet",
      program.provider.connection,
      payer,
      { commitment: "confirmed" }
    );
    console.log(
      "switchboard program loaded: %s",
      sbProgram.programId.toString()
    );

    // load devnet queue
    const sbTestCtx = await sbUtils.SwitchboardTestContext.loadDevnetQueue(
      sbProgram.provider as anchor.AnchorProvider,
      "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy",
      5_000_000
    );
    console.log("switchboard test context loaded");

    // keypair used for client and state seed
    const vrfStateKeypair = anchor.web3.Keypair.generate();

    // create vrf state PDA
    const [vrfState, _vrfStateBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("STATE"),
          vrfStateKeypair.publicKey.toBuffer(),
          wallet.publicKey.toBuffer(),
        ],
        program.programId
      );

    // init instruction coder to define instruction to use as callback
    const ixCoder = new anchor.BorshInstructionCoder(program.idl);
    const callback: sb.Callback = {
      programId: program.programId,
      accounts: [],
      ixData: ixCoder.encode("draw_result", ""),
    };

    // create new VrfAccount
    const vrf = await sb.VrfAccount.create(sbProgram, {
      keypair: vrfStateKeypair,
      authority: vrfState,
      callback: callback,
      queue: sbTestCtx.queue,
    });
    console.log("vrf account created");

    const initLotteryParams = {
      lotteryName: lotteryName,
      drawDurationMs: new anchor.BN(10000),
      ticketPrice: new anchor.BN(0),
      prizeAmount: new anchor.BN(1),
      collectionMetadataSymbol: "TEST",
      collectionMetadataUri: "https://foo.com/collection-metadata.json",
      ticketMetadataName: "Lottery-Ticket",
      ticketMetadataSymbol: "TEST-TICKET",
      ticketMetadataUri: "https://foo.com/foo-metadata.json",
    };

    // init a new lottery
    const initLotteryTxSig = await program.methods
      .initLottery(initLotteryParams)
      .accounts({
        purchaseMint: purchaseMint,
        purchaseVault: purchaseVault,
        prizeMint: prizeMint,
        prizeVault: prizeVault,
        lotteryManager: lotteryManager,
        collectionMint: collectionMint,
        collectionAta: collectionAta,
        collectionMetadata: collectionMd,
        collectionMasterEdition: collectionMe,
        vrf: vrf.publicKey,
        vrfState: vrfState,
        admin: wallet.publicKey,
        adminPrizeAta: adminPrizeAta.address,
        systemProgram: anchor.web3.SystemProgram.programId,
        metadataProgram: mplMd.PROGRAM_ID,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("initLottery: %s", initLotteryTxSig);
  });
});

async function getLamports(
  connection: anchor.web3.Connection,
  account: anchor.web3.PublicKey,
): Promise<void> {

  const txSig1 = await connection.requestAirdrop(
    account,
    anchor.web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(txSig1, "confirmed");

  await delayMs(5000);

  const txSig2 = await connection.requestAirdrop(
    account,
    anchor.web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(txSig2, "confirmed");
}

async function delayMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
