import * as anchor from "@project-serum/anchor";
import * as splToken from "../../node_modules/@solana/spl-token";
import * as mplMd from "@metaplex-foundation/mpl-token-metadata";
import * as sb from "@switchboard-xyz/switchboard-v2";
import * as sbUtils from "@switchboard-xyz/sbv2-utils";
import * as bs58 from "bs58";
import { SolanaLotteryProgram } from "./solana_lottery_program";
const idl = require("./solana_lottery_program.json");

export class Client {
  private program: anchor.Program<SolanaLotteryProgram>;
  private provider: anchor.AnchorProvider;

  constructor(provider: anchor.AnchorProvider) {
    const program = new anchor.Program(
      idl,
      new anchor.web3.PublicKey(idl.metadata.address),
      provider
    );

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

    // switchboard VRF Data
    const sbData = await this.setupSwitchboardVRF(params.sbPayerKeypair);

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
    const vrf = await sb.VrfAccount.create(sbData.sbProgram, {
      keypair: vrfStateKeypair,
      authority: vrfState,
      callback: callback,
      queue: sbData.queue,
    });

    // load account data
    const queue = await sbData.queue.loadData();
    const vrfAccount = await vrf.loadData();

    const [programStateAccount, programStateBump] =
      sb.ProgramStateAccount.fromSeed(sbData.sbProgram);

    // create the permission account
    await sb.PermissionAccount.create(sbData.sbProgram, {
      authority: queue.authority,
      granter: sbData.queue.publicKey,
      grantee: vrf.publicKey,
    });

    // derive the bump
    const [permission, permissionBump] = sb.PermissionAccount.fromSeed(
      sbData.sbProgram,
      queue.authority,
      sbData.queue.publicKey,
      vrf.publicKey
    );

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
        switchboardProgram: sbData.sbProgram.programId,
        vrfOracleQueue: sbData.queue.publicKey,
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

    let buyParams = {
      lotteryName: params.lotteryName,
    };

    // buy a lottery ticket
    return await this.program.methods
      .buy(buyParams)
      .accounts({
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
    let winner: anchor.web3.PublicKey;
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
      winner = winningTicketOwner;
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
      winner = ticketOwner;
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
        winner: winner,
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

  public async waitForDrawResult(lotteryName: string): Promise<number> {
    const [lotteryManager, _lotteryManagerBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_manager"), Buffer.from(lotteryName)],
        this.program.programId
      );

    let listener = null;
    let winningPick: number;
    let [event, _slot] = await new Promise((resolve, _reject) => {
      // setup handler to watch for when we get the draw result from VRF
      listener = this.program.addEventListener(
        "DrawResultSuccessful",
        (event, slot) => {
          if (event.lotteryManager.equals(lotteryManager)) {
            resolve([event, slot]);
          }
        }
      );
    });
    winningPick = event.winningPick;
    await this.program.removeEventListener(listener);

    return winningPick;
  }

  public async waitForDispenseResult(
    lotteryName: string
  ): Promise<anchor.web3.PublicKey | null> {
    const [lotteryManager, _lotteryManagerBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_manager"), Buffer.from(lotteryName)],
        this.program.programId
      );

    let listener = null;
    let winner: anchor.web3.PublicKey | null;
    let [event, _slot] = await new Promise((resolve, _reject) => {
      // setup handler to watch for when we get the draw result from VRF
      listener = this.program.addEventListener(
        "DispenseResult",
        (event, slot) => {
          if (event.lotteryManager.equals(lotteryManager)) {
            resolve([event, slot]);
          }
        }
      );
    });
    winner = event.winner;
    await this.program.removeEventListener(listener);

    return winner;
  }

  public async getLotteryManager(lotteryName: string): Promise<any> {
    const [lotteryManager, _lotteryManagerBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("lottery_manager"), Buffer.from(lotteryName)],
        this.program.programId
      );
    console.log("lotteryManager: %s", lotteryManager.toString());

    return this.program.account.lotteryManager.fetch(lotteryManager);
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

  // payer argument only necessary for mainnet
  public async setupSwitchboardVRF(payer?: anchor.web3.Keypair): Promise<SwitchboardData> {
    let queue: sb.OracleQueueAccount;
    let queueAuthority: anchor.web3.PublicKey;
    let dataBuffer: anchor.web3.PublicKey;
    let sbProgram: any;

    // check if mainnet exists
    const mainnetExists = await this.provider.connection.getAccountInfo(
      sb.SBV2_MAINNET_PID
    );

    if (mainnetExists) {
      sbProgram = await sb.loadSwitchboardProgram(
        "mainnet-beta",
        this.provider.connection,
        payer,
        { commitment: "confirmed" }
      );
      queue = new sb.OracleQueueAccount({
        program: sbProgram,
        publicKey: new anchor.web3.PublicKey(
          "5JYwqvKkqp35w8Nq3ba4z1WYUeJQ1rB36V8XvaGp6zn1"
        ),
      });
      queueAuthority = new anchor.web3.PublicKey(
        "31Sof5r1xi7dfcaz4x9Kuwm8J9ueAdDduMcme59sP8gc"
      );
      dataBuffer = new anchor.web3.PublicKey(
        "FozqXFMS1nQKfPqwVdChr7RJ3y7ccSux39zU682kNYjJ"
      );
      console.log("mainnet vrf set");
    } else {
      // switchboard VRF
      let sbTestCtx: sbUtils.SwitchboardTestContext;
      try {
        // load devnet queue
        sbTestCtx = await sbUtils.SwitchboardTestContext.loadDevnetQueue(
          this.program.provider as anchor.AnchorProvider,
          "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy",
          5_000_000
        );
        console.log("devnet vrf set");
      } catch (e) {
        // load localnet queue from env file
        sbTestCtx = await sbUtils.SwitchboardTestContext.loadFromEnv(
          this.program.provider as anchor.AnchorProvider,
          undefined,
          5_000_000
        );
        console.log("local vrf set");
      }

      const queueData = await sbTestCtx.queue.loadData();

      queue = sbTestCtx.queue;
      queueAuthority = queueData.authority;
      dataBuffer = queueData.dataBuffer;
      sbProgram = sbTestCtx.program;
    }

    const accounts: SwitchboardData = {
      queue: queue,
      queueAuthority: queueAuthority,
      dataBuffer: dataBuffer,
      sbProgram: sbProgram,
    };

    return accounts;
  }
}

export interface InitLotteryParams {
  lotteryName: string;
  prizeMint: anchor.web3.PublicKey;
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
  sbPayerKeypair: anchor.web3.Keypair;
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

export interface SwitchboardData {
  sbProgram: any;
  queue: sb.OracleQueueAccount;
  queueAuthority: anchor.web3.PublicKey;
  dataBuffer: anchor.web3.PublicKey;
}
