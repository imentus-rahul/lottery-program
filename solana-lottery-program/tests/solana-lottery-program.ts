import * as anchor from "@project-serum/anchor";
import * as splToken from "../node_modules/@solana/spl-token";
import * as mpl from "@metaplex-foundation/mpl-token-metadata";
import * as sdk from "../sdk/client";

describe("solana-lottery-program", () => {
  const opts: anchor.web3.ConfirmOptions = {
    skipPreflight: false,
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    maxRetries: 10,
  }
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.local(undefined, opts)

  it("smoke test1", async () => {
    // setup
    const setupAccounts = await setupTest(
      provider.connection,
      1,
      provider.wallet.publicKey,
    );
    console.log("setup complete");

    // lottery client
    const client = new sdk.Client(
      provider
    );

    const lotteryName = Math.random().toString(36).slice(2, 10);

    const initLotteryParams: sdk.InitLotteryParams = {
      lotteryName: lotteryName,
      prizeMint: setupAccounts.prizeMint,
      drawDuration: 2,
      ticketPrice: 1,
      prizeAmount: 1,
      collectionMetadataSymbol: "LOTTO",
      collectionMetadataUri: "https://foo.com/bar.json",
      ticketMetadataName: "LOTTO_TICKETS",
      ticketMetadataSymbol: "TICKET",
      ticketMetadataUri: "https://baz.com/bar.json",
      maxTickets: 10,
      guaranteeWinner: false,
    };

    const initLotteryTxSig = await client.initLottery(initLotteryParams);
    console.log("initLottery: %s", initLotteryTxSig);

    // ticket PDAs
    const buyTicketParams: sdk.BuyParams = {
      lotteryName: lotteryName,
    };
    const buyTicketTxSig = await client.buy(buyTicketParams);
    console.log("buyTicketTxSig: %s", buyTicketTxSig);

    // sleep to let the draw duration expire
    await sleepMs(3000);

    const drawParams: sdk.DrawParams = {
      lotteryName: lotteryName,
    };

    const drawTxSig = await client.draw(drawParams);
    console.log("drawTxSig: %s", drawTxSig);

    console.log("waiting for winningPick event");
    const winningPick = await client.waitForDrawResult(lotteryName);
    console.log("winningPick: %d", winningPick);

    const dispenseParams: sdk.DispenseParams = {
      lotteryName: lotteryName,
    };

    const dispenseTxSig = await client.dispense(dispenseParams);
    console.log("dispenseTxSig: %s", dispenseTxSig);
  });
});

interface SetupAccounts {
  prizeMint: anchor.web3.PublicKey;
  prizeAta: anchor.web3.PublicKey;
}

// setup accounts needed to run tests
async function setupTest(
  connection: anchor.web3.Connection,
  prizeMintToAmount: number,
  admin: anchor.web3.PublicKey,
): Promise<SetupAccounts> {

  const payer = anchor.web3.Keypair.generate();

  // init payer
  await getLamports(connection, payer.publicKey);

  // mock prize
  const prizeMint = await splToken.createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    0
  );

  // create admin ATA and mint the prize so the admin can transfer to the lottery program on init
  const prizeAta = await splToken.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    prizeMint,
    admin,
  );
  await splToken.mintTo(
    connection,
    payer,
    prizeMint,
    prizeAta.address,
    payer.publicKey,
    prizeMintToAmount
  );

  // create metadata account for prize mint
  const [metadata, _metadataBump] = await anchor.web3.PublicKey.findProgramAddress(
    [
        Buffer.from('metadata'),
        mpl.PROGRAM_ID.toBuffer(),
        prizeMint.toBuffer(),
    ], mpl.PROGRAM_ID)

  const mdAccounts: mpl.CreateMetadataAccountV2InstructionAccounts = {
    metadata: metadata,
    mint: prizeMint,
    mintAuthority: payer.publicKey,
    payer: payer.publicKey,
    updateAuthority: payer.publicKey,
  };
  const mdData: mpl.DataV2 = {
    name: "Lottery_Ticket",
    symbol: "TICKET",
    uri: "https://lottery-ticket1.s3.us-west-1.amazonaws.com/ticket.json",
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  }
  const mdArgs: mpl.CreateMetadataAccountArgsV2 = {
    data: mdData,
    isMutable: true,
  }
  const ixArgs: mpl.CreateMetadataAccountV2InstructionArgs = {
    createMetadataAccountArgsV2: mdArgs
  };
  const metadataIx = mpl.createCreateMetadataAccountV2Instruction(mdAccounts, ixArgs);

  // master edition
  const [masterEdition, _masterEditionBump] = await anchor.web3.PublicKey.findProgramAddress(
    [
        Buffer.from('metadata'),
        mpl.PROGRAM_ID.toBuffer(),
        prizeMint.toBuffer(),
        Buffer.from('edition'),
    ], mpl.PROGRAM_ID)

  const meAccounts: mpl.CreateMasterEditionV3InstructionAccounts = {
    metadata: metadata,
    edition: masterEdition,
    mint: prizeMint,
    updateAuthority: payer.publicKey,
    mintAuthority: payer.publicKey,
    payer: payer.publicKey,
  };

  const meArgs: mpl.CreateMasterEditionArgs = {
    maxSupply: new anchor.BN(1),
  };

  const meIxArgs: mpl.CreateMasterEditionV3InstructionArgs = {
    createMasterEditionArgs: meArgs, 
  }
  const masterEditionIx = mpl.createCreateMasterEditionV3Instruction(meAccounts, meIxArgs);

  const createNftAccountsTxSig = await connection.sendTransaction(new anchor.web3.Transaction().add(metadataIx).add(masterEditionIx), [payer]);
  console.log("createNftAccountsTxSig: %s", createNftAccountsTxSig);

  const setupAccounts: SetupAccounts = {
    prizeMint: prizeMint,
    prizeAta: prizeAta.address,
  };

  return setupAccounts;
}

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
