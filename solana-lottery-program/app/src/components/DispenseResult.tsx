import { PublicKey } from "@solana/web3.js";
import { FC, PropsWithChildren, useEffect, useState } from "react";
import { Client } from "sdk/client";

interface Props extends PropsWithChildren {
  complete: boolean;
}

export const DispenseResult: FC<Props> = ({ complete }) => {
  return (
    <div>
      <p>
        {(complete && <p>Lottery is complete! Thanks for playing!</p>) || (
          <p>No Winner yet!</p>
        )}
      </p>
    </div>
  );
};
