#!/bin/bash -e

# copy idls to sdk
cp -r target/types/solana_lottery_program.ts sdk/
cp -r target/idl/solana_lottery_program.json sdk/

# copy sdk to web app directory
cp -r sdk/ app/src/sdk/
