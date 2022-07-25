import { PublicKey } from "@solana/web3.js";
import { FC, useState, useEffect } from "react";
import { Metaplex, Nft } from "@metaplex-foundation/js";

interface Props {
  prizeMint: string;
  metaplexClient: Metaplex;
}

export const NftDisplay: FC<Props> = ({ prizeMint, metaplexClient }) => {
  const [nft, setNft] = useState<Nft | null>(null);
  useEffect(() => {
    const fetchNft = async () => {
      const nft = await metaplexClient
        .nfts()
        .findByMint(new PublicKey(prizeMint))
        .run();
      setNft(nft);
    };

    fetchNft().catch(console.error);
  }, [prizeMint]);

  return (
    <div className="App">
      {nft && (
        <div className="nftPreview">
          <img
            src={nft.json.image!}
            alt="The downloaded illustration of the provided NFT address."
          />
        </div>
      )}
    </div>
  );
};
