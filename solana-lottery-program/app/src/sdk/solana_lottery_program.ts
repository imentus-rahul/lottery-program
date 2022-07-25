export type SolanaLotteryProgram = {
  version: "0.1.0";
  name: "solana_lottery_program";
  instructions: [
    {
      name: "initLottery";
      accounts: [
        {
          name: "purchaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "prizeMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "prizeVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lotteryManager";
          isMut: true;
          isSigner: false;
        },
        {
          name: "collectionMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "collectionAta";
          isMut: true;
          isSigner: false;
        },
        {
          name: "collectionMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "collectionMasterEdition";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vrf";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vrfState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "switchboardProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfOracleQueue";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfQueueAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfDataBuffer";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfPermission";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfEscrow";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfPaymentWallet";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfProgramState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: true;
          isSigner: true;
        },
        {
          name: "adminPrizeAta";
          isMut: true;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "metadataProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "InitLotteryParams";
          };
        }
      ];
    },
    {
      name: "buy";
      accounts: [
        {
          name: "purchaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lotteryManager";
          isMut: true;
          isSigner: false;
        },
        {
          name: "collectionMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "collectionMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "collectionMasterEdition";
          isMut: true;
          isSigner: false;
        },
        {
          name: "ticketMint";
          isMut: true;
          isSigner: true;
        },
        {
          name: "ticketMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "ticketMasterEdition";
          isMut: true;
          isSigner: false;
        },
        {
          name: "ticket";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userTicketAta";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "metadataProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "BuyParams";
          };
        }
      ];
    },
    {
      name: "draw";
      accounts: [
        {
          name: "purchaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lotteryManager";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vrfState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "switchboardProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrf";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vrfOracleQueue";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vrfQueueAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfDataBuffer";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfPermission";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vrfEscrow";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vrfPaymentWallet";
          isMut: true;
          isSigner: false;
        },
        {
          name: "recentBlockhashes";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vrfProgramState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "DrawParams";
          };
        }
      ];
    },
    {
      name: "drawResult";
      accounts: [
        {
          name: "state";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vrf";
          isMut: false;
          isSigner: false;
        },
        {
          name: "lotteryManager";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "dispense";
      accounts: [
        {
          name: "prizeMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "prizeVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lotteryManager";
          isMut: true;
          isSigner: false;
        },
        {
          name: "ticketMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "ticket";
          isMut: false;
          isSigner: false;
        },
        {
          name: "winner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "winnerTicketAta";
          isMut: false;
          isSigner: false;
        },
        {
          name: "winnerPrizeAta";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "DispenseParams";
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "lotteryManager";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lotteryName";
            type: "string";
          },
          {
            name: "purchaseVault";
            type: "publicKey";
          },
          {
            name: "prizeMint";
            type: "publicKey";
          },
          {
            name: "prizeVault";
            type: "publicKey";
          },
          {
            name: "collectionMint";
            type: "publicKey";
          },
          {
            name: "collectionMetadata";
            type: "publicKey";
          },
          {
            name: "collectionMasterEdition";
            type: "publicKey";
          },
          {
            name: "circulatingTicketSupply";
            type: "u64";
          },
          {
            name: "cutoffTime";
            type: "u64";
          },
          {
            name: "drawDuration";
            type: "u64";
          },
          {
            name: "ticketPrice";
            type: "u64";
          },
          {
            name: "winningPick";
            type: {
              option: "u64";
            };
          },
          {
            name: "locked";
            type: "bool";
          },
          {
            name: "maxTickets";
            type: "u64";
          },
          {
            name: "guaranteeWinner";
            type: "bool";
          },
          {
            name: "ticketMetadataName";
            type: "string";
          },
          {
            name: "ticketMetadataSymbol";
            type: "string";
          },
          {
            name: "ticketMetadataUri";
            type: "string";
          },
          {
            name: "complete";
            type: "bool";
          },
          {
            name: "vrf";
            type: "publicKey";
          },
          {
            name: "vrfState";
            type: "publicKey";
          },
          {
            name: "vrfPermission";
            type: "publicKey";
          },
          {
            name: "vrfOracleQueue";
            type: "publicKey";
          },
          {
            name: "vrfQueueAuthority";
            type: "publicKey";
          },
          {
            name: "vrfDataBuffer";
            type: "publicKey";
          },
          {
            name: "vrfEscrow";
            type: "publicKey";
          },
          {
            name: "vrfPaymentAta";
            type: "publicKey";
          },
          {
            name: "vrfProgramState";
            type: "publicKey";
          },
          {
            name: "sbProgramId";
            type: "publicKey";
          },
          {
            name: "vrfStateBump";
            type: "u8";
          },
          {
            name: "vrfPermissionBump";
            type: "u8";
          },
          {
            name: "vrfSbStateBump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "vrfClient";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "maxResult";
            type: "u64";
          },
          {
            name: "resultBuffer";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "result";
            type: "u64";
          },
          {
            name: "lastTimestamp";
            type: "i64";
          },
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "vrf";
            type: "publicKey";
          }
        ];
      };
    },
    {
      name: "ticket";
      type: {
        kind: "struct";
        fields: [
          {
            name: "ticketMint";
            type: "publicKey";
          },
          {
            name: "lotteryManager";
            type: "publicKey";
          },
          {
            name: "pick";
            type: "u64";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "InitLotteryParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lotteryName";
            type: "string";
          },
          {
            name: "drawDuration";
            type: "u64";
          },
          {
            name: "ticketPrice";
            type: "u64";
          },
          {
            name: "prizeAmount";
            type: "u64";
          },
          {
            name: "maxTickets";
            type: "u64";
          },
          {
            name: "guaranteeWinner";
            type: "bool";
          },
          {
            name: "collectionMetadataSymbol";
            type: "string";
          },
          {
            name: "collectionMetadataUri";
            type: "string";
          },
          {
            name: "ticketMetadataSymbol";
            type: "string";
          },
          {
            name: "ticketMetadataUri";
            type: "string";
          },
          {
            name: "vrfPermissionBump";
            type: "u8";
          },
          {
            name: "vrfSbStateBump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "BuyParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lotteryName";
            type: "string";
          }
        ];
      };
    },
    {
      name: "DrawParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lotteryName";
            type: "string";
          },
          {
            name: "vrfClientStateBump";
            type: "u8";
          },
          {
            name: "permissionBump";
            type: "u8";
          },
          {
            name: "switchboardStateBump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "DispenseParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lotteryName";
            type: "string";
          }
        ];
      };
    },
    {
      name: "SLPErrorCode";
      type: {
        kind: "enum";
        variants: [
          {
            name: "TimeRemaining";
          },
          {
            name: "CallDispense";
          },
          {
            name: "CallDraw";
          },
          {
            name: "InvalidPick";
          },
          {
            name: "NoTicketsPurchased";
          },
          {
            name: "PassInWinningPDA";
          },
          {
            name: "NotEnoughTokens";
          },
          {
            name: "InvalidTicketPrice";
          },
          {
            name: "InvalidDrawDuration";
          },
          {
            name: "IncorrectTicketMint";
          },
          {
            name: "WinnerTicketAndPrizeAtasMismatch";
          },
          {
            name: "InvalidSwitchboardVrfAccount";
          },
          {
            name: "MaxResultExceedsMaximum";
          },
          {
            name: "EmptyCurrentRoundResult";
          },
          {
            name: "InvalidAuthorityError";
          },
          {
            name: "MaxTicketsPurchased";
          },
          {
            name: "LotteryComplete";
          }
        ];
      };
    }
  ];
  events: [
    {
      name: "BuySuccessful";
      fields: [
        {
          name: "lotteryManager";
          type: "publicKey";
          index: false;
        },
        {
          name: "circulatingTicketSupply";
          type: "u64";
          index: false;
        }
      ];
    },
    {
      name: "DrawResultSuccessful";
      fields: [
        {
          name: "lotteryManager";
          type: "publicKey";
          index: false;
        },
        {
          name: "winningPick";
          type: "u64";
          index: false;
        }
      ];
    },
    {
      name: "DispenseResult";
      fields: [
        {
          name: "lotteryManager";
          type: "publicKey";
          index: false;
        },
        {
          name: "winner";
          type: {
            option: "publicKey";
          };
          index: false;
        }
      ];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "InvalidSwitchboardVrfAccount";
      msg: "Not a valid Switchboard VRF account";
    },
    {
      code: 6001;
      name: "MaxResultExceedsMaximum";
      msg: "The max result must not exceed u64";
    },
    {
      code: 6002;
      name: "EmptyCurrentRoundResult";
      msg: "Current round result is empty";
    },
    {
      code: 6003;
      name: "InvalidAuthorityError";
      msg: "Invalid authority account provided.";
    }
  ];
};

export const IDL: SolanaLotteryProgram = {
  version: "0.1.0",
  name: "solana_lottery_program",
  instructions: [
    {
      name: "initLottery",
      accounts: [
        {
          name: "purchaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "prizeMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "prizeVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lotteryManager",
          isMut: true,
          isSigner: false,
        },
        {
          name: "collectionMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "collectionAta",
          isMut: true,
          isSigner: false,
        },
        {
          name: "collectionMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "collectionMasterEdition",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vrf",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vrfState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "switchboardProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfOracleQueue",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfQueueAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfDataBuffer",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfPermission",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfEscrow",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfPaymentWallet",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfProgramState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: true,
          isSigner: true,
        },
        {
          name: "adminPrizeAta",
          isMut: true,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "metadataProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "InitLotteryParams",
          },
        },
      ],
    },
    {
      name: "buy",
      accounts: [
        {
          name: "purchaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lotteryManager",
          isMut: true,
          isSigner: false,
        },
        {
          name: "collectionMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "collectionMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "collectionMasterEdition",
          isMut: true,
          isSigner: false,
        },
        {
          name: "ticketMint",
          isMut: true,
          isSigner: true,
        },
        {
          name: "ticketMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "ticketMasterEdition",
          isMut: true,
          isSigner: false,
        },
        {
          name: "ticket",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userTicketAta",
          isMut: true,
          isSigner: false,
        },
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "metadataProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "BuyParams",
          },
        },
      ],
    },
    {
      name: "draw",
      accounts: [
        {
          name: "purchaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lotteryManager",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vrfState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "switchboardProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrf",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vrfOracleQueue",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vrfQueueAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfDataBuffer",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfPermission",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vrfEscrow",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vrfPaymentWallet",
          isMut: true,
          isSigner: false,
        },
        {
          name: "recentBlockhashes",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vrfProgramState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "DrawParams",
          },
        },
      ],
    },
    {
      name: "drawResult",
      accounts: [
        {
          name: "state",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vrf",
          isMut: false,
          isSigner: false,
        },
        {
          name: "lotteryManager",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "dispense",
      accounts: [
        {
          name: "prizeMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "prizeVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lotteryManager",
          isMut: true,
          isSigner: false,
        },
        {
          name: "ticketMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "ticket",
          isMut: false,
          isSigner: false,
        },
        {
          name: "winner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "winnerTicketAta",
          isMut: false,
          isSigner: false,
        },
        {
          name: "winnerPrizeAta",
          isMut: true,
          isSigner: false,
        },
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "DispenseParams",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "lotteryManager",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lotteryName",
            type: "string",
          },
          {
            name: "purchaseVault",
            type: "publicKey",
          },
          {
            name: "prizeMint",
            type: "publicKey",
          },
          {
            name: "prizeVault",
            type: "publicKey",
          },
          {
            name: "collectionMint",
            type: "publicKey",
          },
          {
            name: "collectionMetadata",
            type: "publicKey",
          },
          {
            name: "collectionMasterEdition",
            type: "publicKey",
          },
          {
            name: "circulatingTicketSupply",
            type: "u64",
          },
          {
            name: "cutoffTime",
            type: "u64",
          },
          {
            name: "drawDuration",
            type: "u64",
          },
          {
            name: "ticketPrice",
            type: "u64",
          },
          {
            name: "winningPick",
            type: {
              option: "u64",
            },
          },
          {
            name: "locked",
            type: "bool",
          },
          {
            name: "maxTickets",
            type: "u64",
          },
          {
            name: "guaranteeWinner",
            type: "bool",
          },
          {
            name: "ticketMetadataName",
            type: "string",
          },
          {
            name: "ticketMetadataSymbol",
            type: "string",
          },
          {
            name: "ticketMetadataUri",
            type: "string",
          },
          {
            name: "complete",
            type: "bool",
          },
          {
            name: "vrf",
            type: "publicKey",
          },
          {
            name: "vrfState",
            type: "publicKey",
          },
          {
            name: "vrfPermission",
            type: "publicKey",
          },
          {
            name: "vrfOracleQueue",
            type: "publicKey",
          },
          {
            name: "vrfQueueAuthority",
            type: "publicKey",
          },
          {
            name: "vrfDataBuffer",
            type: "publicKey",
          },
          {
            name: "vrfEscrow",
            type: "publicKey",
          },
          {
            name: "vrfPaymentAta",
            type: "publicKey",
          },
          {
            name: "vrfProgramState",
            type: "publicKey",
          },
          {
            name: "sbProgramId",
            type: "publicKey",
          },
          {
            name: "vrfStateBump",
            type: "u8",
          },
          {
            name: "vrfPermissionBump",
            type: "u8",
          },
          {
            name: "vrfSbStateBump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "vrfClient",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "maxResult",
            type: "u64",
          },
          {
            name: "resultBuffer",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "result",
            type: "u64",
          },
          {
            name: "lastTimestamp",
            type: "i64",
          },
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "vrf",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "ticket",
      type: {
        kind: "struct",
        fields: [
          {
            name: "ticketMint",
            type: "publicKey",
          },
          {
            name: "lotteryManager",
            type: "publicKey",
          },
          {
            name: "pick",
            type: "u64",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "InitLotteryParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lotteryName",
            type: "string",
          },
          {
            name: "drawDuration",
            type: "u64",
          },
          {
            name: "ticketPrice",
            type: "u64",
          },
          {
            name: "prizeAmount",
            type: "u64",
          },
          {
            name: "maxTickets",
            type: "u64",
          },
          {
            name: "guaranteeWinner",
            type: "bool",
          },
          {
            name: "collectionMetadataSymbol",
            type: "string",
          },
          {
            name: "collectionMetadataUri",
            type: "string",
          },
          {
            name: "ticketMetadataSymbol",
            type: "string",
          },
          {
            name: "ticketMetadataUri",
            type: "string",
          },
          {
            name: "vrfPermissionBump",
            type: "u8",
          },
          {
            name: "vrfSbStateBump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "BuyParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lotteryName",
            type: "string",
          },
        ],
      },
    },
    {
      name: "DrawParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lotteryName",
            type: "string",
          },
          {
            name: "vrfClientStateBump",
            type: "u8",
          },
          {
            name: "permissionBump",
            type: "u8",
          },
          {
            name: "switchboardStateBump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "DispenseParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lotteryName",
            type: "string",
          },
        ],
      },
    },
    {
      name: "SLPErrorCode",
      type: {
        kind: "enum",
        variants: [
          {
            name: "TimeRemaining",
          },
          {
            name: "CallDispense",
          },
          {
            name: "CallDraw",
          },
          {
            name: "InvalidPick",
          },
          {
            name: "NoTicketsPurchased",
          },
          {
            name: "PassInWinningPDA",
          },
          {
            name: "NotEnoughTokens",
          },
          {
            name: "InvalidTicketPrice",
          },
          {
            name: "InvalidDrawDuration",
          },
          {
            name: "IncorrectTicketMint",
          },
          {
            name: "WinnerTicketAndPrizeAtasMismatch",
          },
          {
            name: "InvalidSwitchboardVrfAccount",
          },
          {
            name: "MaxResultExceedsMaximum",
          },
          {
            name: "EmptyCurrentRoundResult",
          },
          {
            name: "InvalidAuthorityError",
          },
          {
            name: "MaxTicketsPurchased",
          },
          {
            name: "LotteryComplete",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "BuySuccessful",
      fields: [
        {
          name: "lotteryManager",
          type: "publicKey",
          index: false,
        },
        {
          name: "circulatingTicketSupply",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "DrawResultSuccessful",
      fields: [
        {
          name: "lotteryManager",
          type: "publicKey",
          index: false,
        },
        {
          name: "winningPick",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "DispenseResult",
      fields: [
        {
          name: "lotteryManager",
          type: "publicKey",
          index: false,
        },
        {
          name: "winner",
          type: {
            option: "publicKey",
          },
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidSwitchboardVrfAccount",
      msg: "Not a valid Switchboard VRF account",
    },
    {
      code: 6001,
      name: "MaxResultExceedsMaximum",
      msg: "The max result must not exceed u64",
    },
    {
      code: 6002,
      name: "EmptyCurrentRoundResult",
      msg: "Current round result is empty",
    },
    {
      code: 6003,
      name: "InvalidAuthorityError",
      msg: "Invalid authority account provided.",
    },
  ],
};
