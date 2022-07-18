#!/bin/bash

mkdir -p .anchor/test-ledger

solana-test-validator -r --ledger .anchor/test-ledger --mint D5B1iguWRmkrjiNU6zSt1LxwDocFRyzfab38y4JXwed --bind-address 0.0.0.0 --url https://api.devnet.solana.com --rpc-port 8899  --clone 2TfB33aLaneQb5TNVwyDz3jSZXS6jdW2ARw1Dgf84XCG `# programId` \
--clone J4CArpsbrZqu1axqQ4AnrqREs3jwoyA1M5LMiQQmAzB9 `# programDataAddress` \
--clone CKwZcshn4XDvhaWVH9EXnk3iu19t6t5xP2Sy2pD6TRDp `# idlAddress` \
--clone BYM81n8HvTJuqZU1PmTVcwZ9G8uoji7FKM6EaPkwphPt `# programState` \
--clone FVLfR6C2ckZhbSwBzZY4CX7YBcddUSge5BNeGQv5eKhy `# switchboardVault` \
--clone So11111111111111111111111111111111111111112 `# switchboardMint` \
--clone 8Yi5LmE8MD3Fft8bUtgjqRP92Yucz4CritdteaC1Ssiq `# tokenWallet` \
--clone 6Tv5LmZXDa29DSWuTYLKDrft4ZhGQvuuRQ4fdSisaCyA `# queue` \
--clone D5B1iguWRmkrjiNU6zSt1LxwDocFRyzfab38y4JXwed `# queueAuthority` \
--clone Ajs7a3ax9CarBGqm5yscYSnnLKy7HU5tx7653af5QJJk `# queueBuffer` \
--clone GY76KNAqs4E3qenHgZMXUSdMPvwFWo3CDR8LJ2yZFHZF `# crank` \
--clone EKwEqmg2EsrEkUTF1YZ7vhSBdV9WPCdvwaSWBoD7xzmf `# crankBuffer` \
--clone 76wosLZH5zmBYx26nkUScm1bi92J67a5BgMByxzHiQEm `# oracle` \
--clone D5B1iguWRmkrjiNU6zSt1LxwDocFRyzfab38y4JXwed `# oracleAuthority` \
--clone 7hGRQmgrsqXNQpb2ynedd8KqofgQip1LE7Mww2cmJi5e `# oracleEscrow` \
--clone ESFMocSxRuVR3sd724Pzcdj8XZik55fixjJoQiqTiFT9 `# oraclePermissions` \
--clone 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU `# additionalClonedAccounts`