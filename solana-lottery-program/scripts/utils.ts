import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import * as anchor from "@project-serum/anchor";

export const loadKeypair = (fsPath: string): Keypair => {
  const keypairPath = fsPath.startsWith("/")
    ? fsPath
    : path.join(process.cwd(), fsPath);
  const keypairSecret = new Uint8Array(
    JSON.parse(fs.readFileSync(keypairPath, "utf8"))
  );
  return Keypair.fromSecretKey(keypairSecret);
};

export async function getLamports(
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
