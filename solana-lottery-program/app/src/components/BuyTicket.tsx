import { FC } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Client } from "../sdk/client";
import { notify } from "../utils/notifications";
import { PublicKey } from "@solana/web3.js";

interface Props extends PropsWithChildren {
  lotteryName: string;
  lotteryClient: Client;
  complete: boolean;
}

export const BuyTicket: FC<Props> = ({
  lotteryClient,
  lotteryName,
  complete,
}) => {
  const wallet = useWallet();
  return (
    <div>
      <button
        className="group w-60 m-2 btn animate-pulse disabled:animate-none bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:from-pink-500 hover:to-yellow-500 ... "
        disabled={complete}
        onClick={async () => {
          buyTicket(wallet.publicKey, lotteryClient, lotteryName);
        }}
      >
        <span className="block group-disabled:hidden">Buy Ticket</span>
      </button>
    </div>
  );
};

async function buyTicket(
  publicKey: PublicKey,
  lotteryClient: Client,
  lotteryName: string
) {
  if (!publicKey) {
    notify({
      type: "error",
      message: "error",
      description: "Wallet not connected!",
    });
    return;
  }
  const buyTxSig = await lotteryClient.buy({ lotteryName });
  console.log("buyTxSig: %s", buyTxSig);
  notify({
    type: "success",
    message: "ticket purchased",
    description: buyTxSig,
  });
}
