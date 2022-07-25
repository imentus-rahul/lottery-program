import * as anchor from "@project-serum/anchor";
import * as sdk from "../sdk/client";
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

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: "confirmed" }
  );
  const client = new sdk.Client(provider);

  const lotteryName = "NFT_RAFFLE";

  const params: sdk.DispenseParams = {
    lotteryName: lotteryName,
  };

  const dispenseTxSig = await client.dispense(params);
  console.log("dispenseTxSig: %s", dispenseTxSig);
}

main();
