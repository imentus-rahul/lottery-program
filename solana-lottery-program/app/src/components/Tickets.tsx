import { FC, PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  ticketsMinted: number;
  maxTickets: number;
}

export const Tickets: FC<Props> = ({ ticketsMinted, maxTickets }) => {
  return (
    <div>
      <p>
        {ticketsMinted}/{maxTickets} Tickets Purchased
      </p>
    </div>
  );
};
