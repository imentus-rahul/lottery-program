import { FC, PropsWithChildren } from "react";
import Countdown from "react-countdown";

const DrawTime = () => <span>Time to pick a winner!</span>;

interface Props {
  cutoffTime: number;
  complete: boolean;
}

export const DrawCountdown: FC<Props> = ({ complete, cutoffTime }) => {
  return (
    <div>
      {cutoffTime != 0 && !complete && (
        <Countdown date={cutoffTime * 1000}>
          <DrawTime />
        </Countdown>
      )}
    </div>
  );
};
