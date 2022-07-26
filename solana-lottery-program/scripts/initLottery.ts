import * as anchor from "@project-serum/anchor";
import * as sdk from "../sdk/client";
import * as mpl from "@metaplex-foundation/mpl-token-metadata";
import * as splToken from "../node_modules/@solana/spl-token";
import { loadKeypair, getLamports } from "./utils";

async function main() {
  const connection = new anchor.web3.Connection(process.env.RPC_URL!, {
    commitment: "confirmed",
  });

  // get payer
  let payer: anchor.web3.Keypair;
  if (process.env.USER_KEYPAIR === undefined) {
    payer = anchor.web3.Keypair.generate();
    await getLamports(connection, payer.publicKey);
  } else {
    payer = loadKeypair(process.env.USER_KEYPAIR!);
  }

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
    1
  );

  // create metadata account for prize mint
  const [metadata, _metadataBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        mpl.PROGRAM_ID.toBuffer(),
        prizeMint.toBuffer(),
      ],
      mpl.PROGRAM_ID
    );

  const mdAccounts: mpl.CreateMetadataAccountV2InstructionAccounts = {
    metadata: metadata,
    mint: prizeMint,
    mintAuthority: payer.publicKey,
    payer: payer.publicKey,
    updateAuthority: payer.publicKey,
  };
  const mdData: mpl.DataV2 = {
    name: "Money Bag",
    symbol: "BAG",
    uri: "https://lottery-ticket1.s3.us-west-1.amazonaws.com/collection.json",
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };
  const mdArgs: mpl.CreateMetadataAccountArgsV2 = {
    data: mdData,
    isMutable: true,
  };
  const ixArgs: mpl.CreateMetadataAccountV2InstructionArgs = {
    createMetadataAccountArgsV2: mdArgs,
  };
  const metadataIx = mpl.createCreateMetadataAccountV2Instruction(
    mdAccounts,
    ixArgs
  );

  // master edition
  const [masterEdition, _masterEditionBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        mpl.PROGRAM_ID.toBuffer(),
        prizeMint.toBuffer(),
        Buffer.from("edition"),
      ],
      mpl.PROGRAM_ID
    );

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
  };
  const masterEditionIx = mpl.createCreateMasterEditionV3Instruction(
    meAccounts,
    meIxArgs
  );

  await connection.sendTransaction(
    new anchor.web3.Transaction().add(metadataIx).add(masterEditionIx),
    [payer]
  );
  console.log("nft mint: %s", prizeMint.toString());

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: "confirmed" }
  );
  const client = new sdk.Client(provider);

  const lotteryName = "NFT_RAFFLE";

  const params: sdk.InitLotteryParams = {
    lotteryName: lotteryName,
    prizeMint: prizeMint,
    drawDuration: 100,
    ticketPrice: 0.01,
    prizeAmount: 1,
    collectionMetadataSymbol: "LOTTO",
    collectionMetadataUri:
      "https://lottery-ticket1.s3.us-west-1.amazonaws.com/collection.json",
    ticketMetadataName: "LOTTO_TICKET",
    ticketMetadataSymbol: "TICKET",
    ticketMetadataUri:
      "https://lottery-ticket1.s3.us-west-1.amazonaws.com/ticket.json",
    maxTickets: 100,
    guaranteeWinner: true,
    sbPayerKeypair: payer,
  };

  await client.initLottery(params);
  console.log("initialized lottery: %s", lotteryName);
}

main();
