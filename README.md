# solana-lottery-program

## lottery flow

- users choose numbers, creates PDA numbers and vault pubkey as seed
- users calls `buy` adds in their PDA, receives ticket
- admin calls `draw`, this requests a randomness value from the switchboard oracle. Ticket buys are locked
- switchboard oracle calls `draw_result`, random numbers are written to the lottery manager
- crank calls `dispense` passing in winning PDA, if PDA exists send prize to winner, if not reset draw time and continue on

## localnet testing

```bash
# start local validator and load in all accounts
# disable compute budget
./start-local-validator.sh

# wait for block production to begin

# start oracle which runs in docker 
anchor run oracle

# wait for heartbeats to begin (watch log)

# run tests
anchor test --skip-local-validator --skip-deploy

# kill oracle when finished
docker-compose down
```

### VRF Flow

- Request randomness from the queue for 0.002 wSOL
- The queue assigns an oracle to fulfill a VRF request
- The oracle posts the proof onchain
- Then the oracle sends ~270 txns to verify the proof onchain 
- Once the proof is verified, it populates [u8; 32]
- Then it invokes your program and instruction to let you know the randomness value was completed successfully

### TODO

- configure max tickets
- autopick numbers
- combine tickets
- multiple owners per ticket
- configure max result
- count by slots for draw duration?
- end lottery after prize dispensed
- allow integrations with purchase vault by admin of lottery