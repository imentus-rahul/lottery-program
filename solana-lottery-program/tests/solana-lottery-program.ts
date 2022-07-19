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
  
  console.log("programId: %s", program.programId.toString());

  const wallet = (program.provider as anchor.AnchorProvider).wallet;

  it("init lottery", async () => {
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

    // create admin ATA and mint the prize so the admin can transfer to the lottery program on init
    const adminPurchaseAta = await splToken.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      purchaseMint,
      wallet.publicKey
    );
    await splToken.mintTo(
      program.provider.connection,
      payer,
      purchaseMint,
      adminPurchaseAta.address,
      payer.publicKey,
      100
    );

    console.log("payer & mints created");

    const lotteryName = Math.random().toString(36).slice(2, 7);

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

    let sbTestCtx: sbUtils.SwitchboardTestContext;

    try {
      // load devnet queue
      sbTestCtx = await sbUtils.SwitchboardTestContext.loadDevnetQueue(
        program.provider as anchor.AnchorProvider, "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy", 5_000_000
      );
      console.log("devnet switchboard test context loaded");
    } catch(e) {
      // load localnet queue from env file
      sbTestCtx = await sbUtils.SwitchboardTestContext.loadFromEnv(
        program.provider as anchor.AnchorProvider,
        undefined,
        5_000_000
      );
      console.log("local switchboard test context loaded");
    }
    
    // keypair used for client and state seed
    const vrfStateKeypair = anchor.web3.Keypair.generate();

    // create vrf state PDA
    const [vrfState, vrfStateBump] =
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
      accounts: [
        { pubkey: vrfState, isSigner: false, isWritable: true },
        { pubkey: vrfStateKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: lotteryManager, isSigner: false, isWritable: true },
      ],
      ixData: ixCoder.encode("drawResult", ""),
    };

    // create new VrfAccount
    const vrf = await sb.VrfAccount.create(sbTestCtx.program, {
      keypair: vrfStateKeypair,
      authority: vrfState,
      callback: callback,
      queue: sbTestCtx.queue,
    });
    console.log("vrf account created: %s", vrfState.toString());

    const initLotteryParams = {
      lotteryName: lotteryName,
      drawDuration: new anchor.BN(1000),
      ticketPrice: new anchor.BN(10),
      prizeAmount: new anchor.BN(1),
      collectionMetadataSymbol: "TEST",
      collectionMetadataUri: "https://foo.com/collection-metadata.json",
      ticketMetadataName: "Lottery-Ticket",
      ticketMetadataSymbol: "TICKET",
      ticketMetadataUri: "https://foo.com/foo-metadata.json",
      maxResult: new anchor.BN(100000),
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

    // ticket PDAs

    // metaplex collection accounts
    const ticketMint = await splToken.createMint(
      program.provider.connection,
      payer,
      lotteryManager,
      lotteryManager,
      0
    );
    const userTicketAta = await splToken.getAssociatedTokenAddress(
      ticketMint,
      wallet.publicKey
    );
    console.log("ticketMint created")

    // metadata
    let [ticketMd, _ticketMdBump] =
      await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          mplMd.PROGRAM_ID.toBuffer(),
          ticketMint.toBuffer(),
        ],
        mplMd.PROGRAM_ID
      );
    // master edition
    let [ticketMe, _ticketMeBump] =
      await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          mplMd.PROGRAM_ID.toBuffer(),
          ticketMint.toBuffer(),
          Buffer.from("edition"),
        ],
        mplMd.PROGRAM_ID
      );

    // pick some numbers
    const pick = [0, 1, 2, 3, 4, 5];

    // ticket PDA holds the metadata
    const [ticket, _ticketBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Uint8Array.from(pick), lotteryManager.toBuffer()],
      program.programId
    );

    let buyParams = {
      lotteryName: lotteryName,
      numbers: pick,
    };

    // buy a lottery ticket
    const buyTxSig = await program.methods
      .buy(buyParams)
      .accounts({
        purchaseMint: purchaseMint,
        purchaseVault: purchaseVault,
        lotteryManager: lotteryManager,
        collectionMint: collectionMint,
        collectionMetadata: collectionMd,
        collectionMasterEdition: collectionMe,
        ticketMint: ticketMint,
        ticketMetadata: ticketMd,
        ticketMasterEdition: ticketMe,
        ticket: ticket,
        userTicketAta: userTicketAta,
        user: wallet.publicKey,
        userPurchaseAta: adminPurchaseAta.address,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: mplMd.PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("buyTxSig: %s", buyTxSig);

    // load account data
    const queue = await sbTestCtx.queue.loadData();
    const vrfAccount = await vrf.loadData();
    console.log("queue and vrf accounts loaded");

    const [programStateAccount, programStateBump] =
      sb.ProgramStateAccount.fromSeed(sbTestCtx.program);

    // create the permission account
    const permissionAccount = await sb.PermissionAccount.create(sbTestCtx.program, {
      authority: queue.authority,
      granter: sbTestCtx.queue.publicKey,
      grantee: vrf.publicKey,
    });

    //const setPermissionTx = await permissionAccount.setTx({
    //  authority: wallet.publicKey,
    //  permission: sb.SwitchboardPermission.PERMIT_VRF_REQUESTS,
    //  enable: true,
    //});

    //const setPermissionTxSig = await program.provider.sendAndConfirm!(setPermissionTx);
    //console.log("setPermissionTxSig: %s", setPermissionTxSig);

    // derive the bump
    const [permission, permissionBump] = sb.PermissionAccount.fromSeed(
      sbTestCtx.program,
      queue.authority,
      sbTestCtx.queue.publicKey,
      vrf.publicKey
    );
    console.log("program state and permission accounts loaded");

    // get the payment mint that the oracle requires
    const paymentMint = await programStateAccount.getTokenMint();
    const adminPaymentMintAta =
      await splToken.getOrCreateAssociatedTokenAccount(
        program.provider.connection,
        payer,
        paymentMint.address,
        wallet.publicKey
      );
    console.log("paymentATA created");

    // sleep and let the draw duration expire
    await sleepMs(3000);

    const drawParams = {
      lotteryName: lotteryName,
      vrfClientStateBump: vrfStateBump,
      permissionBump: permissionBump,
      switchboardStateBump: programStateBump,
    };

    const drawTxSig = await program.methods
      .draw(drawParams)
      .accounts({
        purchaseMint: purchaseMint,
        purchaseVault: purchaseVault,
        lotteryManager: lotteryManager,
        vrfState: vrfState,
        switchboardProgram: sbTestCtx.program.programId,
        vrf: vrf.publicKey,
        oracleQueue: sbTestCtx.queue.publicKey,
        queueAuthority: queue.authority,
        dataBuffer: queue.dataBuffer,
        permission: permission.publicKey,
        escrow: vrfAccount.escrow,
        vrfPaymentWallet: adminPaymentMintAta.address,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        programState: programStateAccount.publicKey,
        admin: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("drawTxSig: %s", drawTxSig);

    //const drawResultTxSig = await program.methods.drawResult().accounts({
    //  vrf: vrf.publicKey,
    //  state: vrfState,
    //  lotteryManager: lotteryManager,
    //}).rpc();
    //console.log("drawResultTxSig: %s", drawResultTxSig);

    console.log('sleep to wait for vrf');
    await sleepMs(30000);
    console.log('end sleep to wait for vrf');

    // fetch lottery manager for on chain data
    const lotteryManagerData = await program.account.lotteryManager.fetch(
      lotteryManager, "confirmed"
    );
    const winningNumbers = lotteryManagerData.winningNumbers;
    console.log("winningNumbers", winningNumbers);

    // get owner of ticket nft

    // create winning ticket PDA
    const [winningTicket, _winningTicketBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Uint8Array.from(winningNumbers), lotteryManager.toBuffer()],
        program.programId
      );

    // set owner to user wallet as default
    // if a winning ticket exists this will be overwritten with the ticket owner's pubkey
    let winningTicketOwner = new anchor.web3.PublicKey(wallet.publicKey);

    // set to some existing mint that will be overwritten with the winning ticket mint later
    let winningTicketMint = prizeMint;

    try {
      const winningTicketAccount = await program.account.ticket.fetch(
        winningTicket
      );
      // get largest token account holders of nft, there should only be 1 with an amount of 1
      const largestAccounts =
        await program.provider.connection.getTokenLargestAccounts(
          winningTicketAccount.ticketMint
        );
      // get parsed data of the largest account
      const largestAccountInfo =
        await program.provider.connection.getParsedAccountInfo(
          largestAccounts.value[0].address
        );
      winningTicketOwner = new anchor.web3.PublicKey(
        (
          largestAccountInfo.value?.data as anchor.web3.ParsedAccountData
        ).parsed.info.owner
      );

      winningTicketMint = winningTicketAccount.ticketMint;
    } catch (e) {
      console.log("WINNER NOT FOUND: %s", e);
    }

    // get ATA's for both the winning ticket and the prize
    const winnerTicketAta = await splToken.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      winningTicketMint,
      winningTicketOwner
    );

    const winnerPrizeAta = await splToken.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      payer,
      prizeMint,
      winningTicketOwner
    );

    // dispense prize
    let dispenseParams = {
      lotteryName: lotteryName,
      numbers: winningNumbers,
    };
    const dispenseTxSig = await program.methods
      .dispense(dispenseParams)
      .accounts({
        prizeMint: prizeMint,
        prizeVault: prizeVault,
        lotteryManager: lotteryManager,
        collectionMint: collectionMint,
        ticket: winningTicket,
        winnerTicketAta: winnerTicketAta.address,
        winnerPrizeAta: winnerPrizeAta.address,
        user: wallet.publicKey,
        associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("dispenseTxSig: %s", dispenseTxSig);
  });
});

async function getLamports(
  connection: anchor.web3.Connection,
  account: anchor.web3.PublicKey
): Promise<void> {
  for (var i = 0; i < 5; i++) {
    const txSig = await connection.requestAirdrop(
      account,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(txSig, "confirmed");
    sleepMs(1000);
  } 
}

async function sleepMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
