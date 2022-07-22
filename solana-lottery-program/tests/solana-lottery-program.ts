import * as anchor from "@project-serum/anchor";
import * as splToken from "../node_modules/@solana/spl-token";
import * as sdk from "../sdk/client";

describe("solana-lottery-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();

  it("smoke test1", async () => {
    // setup
    const setupAccounts = await setupTest(
      provider.connection.rpcEndpoint,
      100,
      1
    );
    console.log("setup complete");

    // lottery client
    const client = new sdk.Client(
      provider.connection.rpcEndpoint,
      setupAccounts.payer
    );

    const lotteryName = Math.random().toString(36).slice(2, 10);

    const initLotteryParams: sdk.InitLotteryParams = {
      lotteryName: lotteryName,
      prizeMint: setupAccounts.prizeMint,
      purchaseMint: setupAccounts.purchaseMint,
      drawDuration: 3,
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
    const winningPick = await client.waitForDrawResult();
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
  purchaseMint: anchor.web3.PublicKey;
  prizeAta: anchor.web3.PublicKey;
  purchaseAta: anchor.web3.PublicKey;
  payer: anchor.web3.Keypair;
}

// setup accounts needed to run tests
async function setupTest(
  rpcEndpoint: string,
  purchaseMintToAmount: number,
  prizeMintToAmount: number
): Promise<SetupAccounts> {
  const connection = new anchor.web3.Connection(rpcEndpoint, "confirmed");

  const payer = anchor.web3.Keypair.generate();

  // init payer
  await getLamports(connection, payer.publicKey);

  // init both mints and make the payer the authority
  const purchaseMint = await splToken.createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6
  );

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
    payer.publicKey
  );
  await splToken.mintTo(
    connection,
    payer,
    prizeMint,
    prizeAta.address,
    payer.publicKey,
    prizeMintToAmount
  );

  // create admin ATA and mint the prize so the admin can transfer to the lottery program on init
  const purchaseAta = await splToken.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    purchaseMint,
    payer.publicKey
  );
  await splToken.mintTo(
    connection,
    payer,
    purchaseMint,
    purchaseAta.address,
    payer.publicKey,
    purchaseMintToAmount
  );

  const setupAccounts: SetupAccounts = {
    prizeMint: prizeMint,
    purchaseMint: purchaseMint,
    prizeAta: prizeAta.address,
    purchaseAta: purchaseAta.address,
    payer: payer,
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
