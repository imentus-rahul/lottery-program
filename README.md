# solana-lottery-program

## lottery flow

- users choose numbers, creates PDA numbers and vault pubkey as seed
- users calls `buy` adds in their PDA, receives ticket
- admin calls `draw`, this requests a randomness value from the switchboard oracle. Ticket buys are locked
- switchboard oracle calls `draw_result`, random numbers are written to the lottery manager
- crank calls `dispense` passing in winning PDA, if PDA exists send prize to winner, if not reset draw time and continue on


### TODO

- only allow switchboard oracle to call draw_result
- configure max result
- configure max tickets