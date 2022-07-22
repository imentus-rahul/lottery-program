import * as anchor from "@project-serum/anchor";
import * as splToken from "../node_modules/@solana/spl-token";
import * as mplMd from "@metaplex-foundation/mpl-token-metadata";
import * as sb from "@switchboard-xyz/switchboard-v2";
import * as sbUtils from "@switchboard-xyz/sbv2-utils";
import * as bs58 from "bs58";
import { SolanaLotteryProgram } from "../target/types/solana_lottery_program";

export class Client {
  private program: anchor.Program<SolanaLotteryProgram>;
  private provider: anchor.AnchorProvider;

  constructor(rpcEndpoint: string, user: anchor.web3.Keypair) {
    const connection = new anchor.web3.Connection(rpcEndpoint, "confirmed");
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(user),
      { commitment: "confirmed" }
    );
    anchor.setProvider(provider);

    const program = anchor.workspace
      .SolanaLotteryProgram as anchor.Program<SolanaLotteryProgram>;

    this.provider = provider;
    this.program = program;
  }

  // init a new lottery, returns transaction signature
  public async initLottery(params: InitLotteryParams): Promise<string> {
    // create lottery pdas
    const [purchaseVault, _purchaseVaultBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("purchase_vault"), Buffer.from(params.lotteryName)],
        this.program.programId
      );
    const [prizeVault, _prizeVaultBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("prize_vault"), Buffer.from(params.lotteryName)],
        this.program.programId
      );
    const [lotteryManager, _lotteryManagerBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_manager"), Buffer.from(params.lotteryName)],
        this.program.programId
      );
    console.log("lotteryManager: %s", lotteryManager.toString());

    // metaplex collection accounts
    const [collectionMint, _collectionMintBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("collection_mint"), Buffer.from(params.lotteryName)],
        this.program.programId
      );

    const [collectionAta, _collectionAtaBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [collectionMint.toBuffer()],
        this.program.programId
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
        this.program.provider as anchor.AnchorProvider,
        "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy",
        5_000_000
      );
      console.log("devnet switchboard test context loaded");
    } catch (e) {
      // load localnet queue from env file
      sbTestCtx = await sbUtils.SwitchboardTestContext.loadFromEnv(
        this.program.provider as anchor.AnchorProvider,
        undefined,
        5_000_000
      );
      console.log("local switchboard test context loaded");
    }

    // keypair used for client and state seed
    const vrfStateKeypair = anchor.web3.Keypair.generate();

    // create vrf state PDA
    const [vrfState, _vrfStateBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("STATE"),
          vrfStateKeypair.publicKey.toBuffer(),
          this.provider.wallet.publicKey.toBuffer(),
        ],
        this.program.programId
      );

    // init instruction coder to define instruction to use as callback
    const ixCoder = new anchor.BorshInstructionCoder(this.program.idl);
    const callback: sb.Callback = {
      programId: this.program.programId,
      accounts: [
        { pubkey: vrfState, isSigner: false, isWritable: true },
        {
          pubkey: vrfStateKeypair.publicKey,
          isSigner: false,
          isWritable: false,
        },
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

    // load account data
    const queue = await sbTestCtx.queue.loadData();
    const vrfAccount = await vrf.loadData();
    console.log("queue and vrf accounts loaded");

    const [programStateAccount, programStateBump] =
      sb.ProgramStateAccount.fromSeed(sbTestCtx.program);

    // create the permission account
    await sb.PermissionAccount.create(sbTestCtx.program, {
      authority: queue.authority,
      granter: sbTestCtx.queue.publicKey,
      grantee: vrf.publicKey,
    });

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
    const adminPaymentMintAta = await splToken.getAssociatedTokenAddress(
      paymentMint.address,
      this.provider.wallet.publicKey
    );

    // we expect ATA to already be created for the lottery creator as they have to transfer the token from this address in the init anyway
    const adminPrizeAta = await splToken.getAssociatedTokenAddress(
      params.prizeMint,
      this.provider.wallet.publicKey
    );

    // instruction params
    const initLotteryParams = {
      lotteryName: params.lotteryName,
      drawDuration: new anchor.BN(params.drawDuration),
      ticketPrice: new anchor.BN(params.ticketPrice),
      prizeAmount: new anchor.BN(params.prizeAmount),
      collectionMetadataSymbol: params.collectionMetadataSymbol,
      collectionMetadataUri: params.collectionMetadataUri,
      ticketMetadataName: params.ticketMetadataName,
      ticketMetadataSymbol: params.ticketMetadataSymbol,
      ticketMetadataUri: params.ticketMetadataUri,
      maxTickets: new anchor.BN(params.maxTickets),
      guaranteeWinner: params.guaranteeWinner,
      vrfPermissionBump: permissionBump,
      vrfSbStateBump: programStateBump,
    };

    // init a new lottery
    return await this.program.methods
      .initLottery(initLotteryParams)
      .accounts({
        purchaseMint: params.purchaseMint,
        purchaseVault: purchaseVault,
        prizeMint: params.prizeMint,
        prizeVault: prizeVault,
        lotteryManager: lotteryManager,
        collectionMint: collectionMint,
        collectionAta: collectionAta,
        collectionMetadata: collectionMd,
        collectionMasterEdition: collectionMe,
        vrf: vrf.publicKey,
        vrfState: vrfState,
        switchboardProgram: sbTestCtx.program.programId,
        vrfOracleQueue: sbTestCtx.queue.publicKey,
        vrfQueueAuthority: queue.authority,
        vrfDataBuffer: queue.dataBuffer,
        vrfPermission: permission.publicKey,
        vrfEscrow: vrfAccount.escrow,
        vrfPaymentWallet: adminPaymentMintAta,
        vrfProgramState: programStateAccount.publicKey,
        admin: this.provider.wallet.publicKey,
        adminPrizeAta: adminPrizeAta,
        systemProgram: anchor.web3.SystemProgram.programId,
        metadataProgram: mplMd.PROGRAM_ID,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  }

  // buy a ticket
  public async buy(params: BuyParams): Promise<string> {
    const [lotteryManager, _lotteryManagerBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_manager"), Buffer.from(params.lotteryName)],
        this.program.programId
      );
    console.log("lotteryManager: %s", lotteryManager.toString());
    const lotteryManagerData = await this.program.account.lotteryManager.fetch(
      lotteryManager,
      "confirmed"
    );

    const ticketMintKeypair = anchor.web3.Keypair.generate();

    const userTicketAta = await splToken.getAssociatedTokenAddress(
      ticketMintKeypair.publicKey,
      this.provider.wallet.publicKey
    );

    // metadata
    let [ticketMd, _ticketMdBump] =
      await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          mplMd.PROGRAM_ID.toBuffer(),
          ticketMintKeypair.publicKey.toBuffer(),
        ],
        mplMd.PROGRAM_ID
      );
    // master edition
    let [ticketMe, _ticketMeBump] =
      await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          mplMd.PROGRAM_ID.toBuffer(),
          ticketMintKeypair.publicKey.toBuffer(),
          Buffer.from("edition"),
        ],
        mplMd.PROGRAM_ID
      );

    // ticket PDA holds the metadata
    const [ticket, _ticketBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        lotteryManager.toBuffer(),
        ticketMintKeypair.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    const userPurchaseAta = await splToken.getAssociatedTokenAddress(
      lotteryManagerData.purchaseMint,
      this.provider.wallet.publicKey
    );

    let buyParams = {
      lotteryName: params.lotteryName,
    };

    // buy a lottery ticket
    return await this.program.methods
      .buy(buyParams)
      .accounts({
        purchaseMint: lotteryManagerData.purchaseMint,
        purchaseVault: lotteryManagerData.purchaseVault,
        lotteryManager: lotteryManager,
        collectionMint: lotteryManagerData.collectionMint,
        collectionMetadata: lotteryManagerData.collectionMetadata,
        collectionMasterEdition: lotteryManagerData.collectionMasterEdition,
        ticketMint: ticketMintKeypair.publicKey,
        ticketMetadata: ticketMd,
        ticketMasterEdition: ticketMe,
        ticket: ticket,
        userTicketAta: userTicketAta,
        user: this.provider.wallet.publicKey,
        userPurchaseAta: userPurchaseAta,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: mplMd.PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ticketMintKeypair])
      .rpc();
  }

  public async draw(params: DrawParams): Promise<string> {
    const [lotteryManager, _lotteryManagerBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_manager"), Buffer.from(params.lotteryName)],
        this.program.programId
      );

    console.log("lotteryManager: %s", lotteryManager.toString());
    const lotteryManagerData = await this.program.account.lotteryManager.fetch(
      lotteryManager,
      "confirmed"
    );

    const drawParams = {
      lotteryName: params.lotteryName,
      vrfClientStateBump: lotteryManagerData.vrfStateBump,
      permissionBump: lotteryManagerData.vrfPermissionBump,
      switchboardStateBump: lotteryManagerData.vrfSbStateBump,
    };

    return await this.program.methods
      .draw(drawParams)
      .accounts({
        purchaseMint: lotteryManagerData.purchaseMint,
        purchaseVault: lotteryManagerData.purchaseVault,
        lotteryManager: lotteryManager,
        vrfState: lotteryManagerData.vrfState,
        switchboardProgram: lotteryManagerData.sbProgramId,
        vrf: lotteryManagerData.vrf,
        vrfOracleQueue: lotteryManagerData.vrfOracleQueue,
        vrfQueueAuthority: lotteryManagerData.vrfQueueAuthority,
        vrfDataBuffer: lotteryManagerData.vrfDataBuffer,
        vrfPermission: lotteryManagerData.vrfPermission,
        vrfEscrow: lotteryManagerData.vrfEscrow,
        vrfPaymentWallet: lotteryManagerData.vrfPaymentAta,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        vrfProgramState: lotteryManagerData.vrfProgramState,
        admin: this.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  }

  public async dispense(params: DispenseParams): Promise<string> {
    const [lotteryManager, _lotteryManagerBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_manager"), Buffer.from(params.lotteryName)],
        this.program.programId
      );
    const lotteryManagerData = await this.program.account.lotteryManager.fetch(
      lotteryManager,
      "confirmed"
    );

    const winningPick = lotteryManagerData.winningPick.toNumber();
    const circulatingTicketSupply =
      lotteryManagerData.circulatingTicketSupply.toNumber();
    console.log(
      "winningPick: %d, circulatingTicketSupply: %d",
      winningPick,
      circulatingTicketSupply
    );

    // if true, there is a winning ticket
    let winningMint: anchor.web3.PublicKey;
    let winningTicketPda: anchor.web3.PublicKey;
    let winningTicketAta: anchor.web3.PublicKey;
    let prizeAta: anchor.web3.PublicKey;
    if (winningPick < circulatingTicketSupply) {
      console.log("winner found, grabbing winning ticket");
      // get winning ticket pda
      winningTicketPda = await this.getWinningTicketPDA(
        lotteryManager,
        winningPick
      );

      const [winningTicketOwner, winningTicketMint] =
        await this.getTicketOwnerAndMint(winningTicketPda);
      winningTicketAta = await splToken.getAssociatedTokenAddress(
        winningTicketMint,
        winningTicketOwner
      );
      prizeAta = await splToken.getAssociatedTokenAddress(
        lotteryManagerData.prizeMint,
        winningTicketOwner
      );
      winningMint = winningTicketMint;
    } else {
      console.log("no winner, grabbing any ticket");
      // get any ticket that has been minted for the collection since there is not a winner
      const ticketPda = await this.getTicketPDA(lotteryManager);
      const [ticketOwner, ticketMint] = await this.getTicketOwnerAndMint(
        ticketPda
      );
      winningTicketAta = await splToken.getAssociatedTokenAddress(
        ticketMint,
        ticketOwner
      );
      prizeAta = await splToken.getAssociatedTokenAddress(
        lotteryManagerData.prizeMint,
        ticketOwner
      );
      // use any ticket pda
      winningTicketPda = ticketPda;
      winningMint = ticketMint;
    }

    let dispenseParams = {
      lotteryName: params.lotteryName,
    };

    return await this.program.methods
      .dispense(dispenseParams)
      .accounts({
        prizeMint: lotteryManagerData.prizeMint,
        prizeVault: lotteryManagerData.prizeVault,
        lotteryManager: lotteryManager,
        ticketMint: winningMint,
        ticket: winningTicketPda,
        winnerTicketAta: winningTicketAta,
        winnerPrizeAta: prizeAta,
        user: this.provider.wallet.publicKey,
        associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  }

  public async waitForDrawResult(): Promise<number> {
    let listener = null;
    let winningPick: number;
    let [event, _slot] = await new Promise((resolve, _reject) => {
      // setup handler to watch for when we get the draw result from VRF
      listener = this.program.addEventListener(
        "DrawResultSuccessful",
        (event, slot) => {
          resolve([event, slot]);
        }
      );
    });
    winningPick = event.winningPick;
    await this.program.removeEventListener(listener);

    return winningPick;
  }

  public async getWinningTicketPDA(
    lotteryManager: anchor.web3.PublicKey,
    winningPick: number
  ): Promise<anchor.web3.PublicKey> {
    // return all ticket accounts to find available numbers to pick
    const ticketMemCmpFilterLotteryManager: anchor.web3.MemcmpFilter = {
      memcmp: {
        offset: 40,
        bytes: lotteryManager.toString(),
      },
    };
    const ticketMemCmpFilterWinningPick: anchor.web3.MemcmpFilter = {
      memcmp: {
        offset: 72,
        bytes: bs58.encode([winningPick]),
      },
    };
    const ticketDataSizeFilter: anchor.web3.DataSizeFilter = {
      dataSize: 80,
    };
    const tickets = await this.program.account.ticket.all([
      ticketDataSizeFilter,
      ticketMemCmpFilterLotteryManager,
      ticketMemCmpFilterWinningPick,
    ]);
    console.log("found %d tickets", tickets.length);

    return tickets[0].publicKey;
  }

  public async getTicketPDA(
    lotteryManager: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> {
    // return all ticket accounts to find available numbers to pick
    const ticketMemCmpFilterLotteryManager: anchor.web3.MemcmpFilter = {
      memcmp: {
        offset: 40,
        bytes: lotteryManager.toString(),
      },
    };
    const ticketDataSizeFilter: anchor.web3.DataSizeFilter = {
      dataSize: 80,
    };
    const tickets = await this.program.account.ticket.all([
      ticketDataSizeFilter,
      ticketMemCmpFilterLotteryManager,
    ]);
    console.log("found %d tickets", tickets.length);

    return tickets[0].publicKey;
  }

  public async getTicketOwnerAndMint(
    ticketPda: anchor.web3.PublicKey
  ): Promise<[anchor.web3.PublicKey, anchor.web3.PublicKey]> {
    const ticketAccount = await this.program.account.ticket.fetch(ticketPda);
    const largestAccounts =
      await this.program.provider.connection.getTokenLargestAccounts(
        ticketAccount.ticketMint
      );
    // get parsed data of the largest account
    const largestAccountInfo =
      await this.program.provider.connection.getParsedAccountInfo(
        largestAccounts.value[0].address
      );
    const ticketOwner = new anchor.web3.PublicKey(
      (
        largestAccountInfo.value?.data as anchor.web3.ParsedAccountData
      ).parsed.info.owner
    );

    return [ticketOwner, ticketAccount.ticketMint];
  }
}

export interface InitLotteryParams {
  lotteryName: string;
  prizeMint: anchor.web3.PublicKey;
  purchaseMint: anchor.web3.PublicKey;
  drawDuration: number;
  ticketPrice: number;
  prizeAmount: number;
  collectionMetadataSymbol: string;
  collectionMetadataUri: string;
  ticketMetadataName: string;
  ticketMetadataSymbol: string;
  ticketMetadataUri: string;
  maxTickets: number;
  guaranteeWinner: boolean;
}

export interface BuyParams {
  lotteryName: string;
}

export interface DrawParams {
  lotteryName: string;
}

export interface DispenseParams {
  lotteryName: string;
}
