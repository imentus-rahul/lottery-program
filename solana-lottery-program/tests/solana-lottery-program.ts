import * as anchor from "@project-serum/anchor";
import * as splToken from "../node_modules/@solana/spl-token";
import * as sdk from "../sdk/client";

describe("solana-lottery-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();

  it("smoke test1", async () => {
    // init payer
    const payer = anchor.web3.Keypair.generate();
    await getLamports(provider.connection, payer.publicKey);

    // init both mints and make the payer the authority
    const purchaseMint = await splToken.createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    // mock NFT
    const prizeMint = await splToken.createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      0
    );

    // create admin ATA and mint the prize so the admin can transfer to the lottery program on init
    const adminPrizeAta = await splToken.getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      prizeMint,
      payer.publicKey
    );
    await splToken.mintTo(
      provider.connection,
      payer,
      prizeMint,
      adminPrizeAta.address,
      payer.publicKey,
      1
    );

    // create admin ATA and mint the prize so the admin can transfer to the lottery program on init
    const adminPurchaseAta = await splToken.getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      purchaseMint,
      payer.publicKey
    );
    await splToken.mintTo(
      provider.connection,
      payer,
      purchaseMint,
      adminPurchaseAta.address,
      payer.publicKey,
      100
    );

    await sleepMs(1000);
    console.log("setup complete");

    // lottery client
    const client = new sdk.Client(provider.connection.rpcEndpoint, payer);

    const lotteryName = Math.random().toString(36).slice(2, 10);

    const initLotteryParams: sdk.InitLotteryParams = {
      lotteryName: lotteryName,
      prizeMint: prizeMint,
      purchaseMint: purchaseMint,
      drawDuration: 10,
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

    // sleep and let the draw duration expire
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
