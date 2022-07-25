// Next, React
import { FC, useEffect, useState } from "react";

// Wallet
import { useWallet, useConnection } from "@solana/wallet-adapter-react";

// Components
import { BuyTicket } from "../../components/BuyTicket";
import { NftDisplay } from "components/NftDisplay";

// Store
import { DrawCountdown } from "components/DrawCountdown";

import { Cluster } from "@solana/web3.js";
import { AnchorProvider } from "@project-serum/anchor";
import { Client } from "../../sdk/client";
import { Metaplex } from "@metaplex-foundation/js";
import { useNetworkConfiguration } from "contexts/NetworkConfigurationProvider";
import { Tickets } from "components/Tickets";
import { DispenseResult } from "components/DispenseResult";

export const HomeView: FC = ({}) => {
  const { connection } = useConnection();
  const { networkConfiguration } = useNetworkConfiguration();
  const wallet = useWallet();
  const provider = new AnchorProvider(connection, wallet, {});

  const lotteryClient = new Client(provider);
  const metaplexClient = Metaplex.make(connection, {
    cluster: networkConfiguration as Cluster,
  });

  const lotteryName = process.env.NEXT_PUBLIC_LOTTERY_NAME;
  console.log("loading lottery: %s", lotteryName);

  if (!wallet) {
    console.log("wallet null Homeview");
  }

  const [lotteryManager, setLotteryManager] = useState<any | null>(null);
  useEffect(() => {
    const getLotteryManager = async () => {
      const lotteryManager = await lotteryClient.getLotteryManager(lotteryName);
      setLotteryManager(lotteryManager);
      console.log("lotteryManager: %s", JSON.stringify(lotteryManager));
    };

    getLotteryManager().catch(console.error);

    // poll lottery manager for updated data at an interval
    const interval = setInterval(() => {
      getLotteryManager().catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="md:hero mx-auto p-4">
      <div className="md:hero-content flex flex-col">
        <h1 className="text-center text-5xl md:pl-12 font-bold text-transparent bg-clip-text bg-gradient-to-tr from-[#9945FF] to-[#14F195]">
          {lotteryName}
        </h1>
        <div className="md:w-full text-center">
          <h1>
            {lotteryManager && lotteryManager && (
              <DrawCountdown
                complete={lotteryManager.complete}
                cutoffTime={lotteryManager.cutoffTime.toNumber()}
              />
            )}
          </h1>
        </div>
        <div className="max-w-md mx-auto bg-primary p-6 my-2">
          {lotteryManager && metaplexClient && (
            <NftDisplay
              metaplexClient={metaplexClient}
              prizeMint={lotteryManager.prizeMint}
            />
          )}
        </div>
        <div className="text-center">
          {lotteryManager && (
            <Tickets
              ticketsMinted={lotteryManager.circulatingTicketSupply.toNumber()}
              maxTickets={lotteryManager.maxTickets.toNumber()}
            />
          )}
        </div>
        <div className="text-center">
          {lotteryClient && lotteryManager && (
            <BuyTicket
              complete={lotteryManager.complete}
              lotteryClient={lotteryClient}
              lotteryName={lotteryName}
            />
          )}
        </div>
        <div className="text-center">
          {lotteryClient && lotteryManager && (
            <DispenseResult complete={lotteryManager.complete} />
          )}
        </div>
      </div>
    </div>
  );
};
