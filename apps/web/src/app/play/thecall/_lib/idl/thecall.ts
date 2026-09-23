/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/thecall.json`.
 */
export type Thecall = {
  "address": "83f9z9RHjyvFSbcvWQixNq13vXiu35baFiDtqvG8q7LY",
  "metadata": {
    "name": "thecall",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "The Call is a Pyth settled prediction market on stock outcomes.",
    "",
    "A creator opens a market on a price feed with a target and a deadline. Users",
    "bet YES or NO in USDC, which is escrowed by the program. After the deadline",
    "anyone resolves the market by passing a Pyth price update, which the program",
    "reads on chain with a staleness check and a feed id binding, then sets the",
    "winning side by comparing the settled price to the target in fixed point.",
    "Winners claim their stake plus a pro rata share of the losing pool.",
    "",
    "Pyth is the settlement authority here, not a display. The comparison is",
    "integer only, there are no floats on chain."
  ],
  "instructions": [
    {
      "name": "bet",
      "docs": [
        "Bet `amount` USDC on `side` (0 = NO, 1 = YES). The USDC moves into the",
        "market escrow. A user holds one bet per market, so a second bet must be on",
        "the same side and adds to the stake."
      ],
      "discriminator": [
        94,
        203,
        166,
        126,
        20,
        243,
        169,
        82
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "userUsdcAta",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claim",
      "docs": [
        "Claim a winning bet. Pays the stake plus a pro rata share of the losing",
        "pool from escrow, then marks the bet claimed. Losers cannot claim."
      ],
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "market"
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "userUsdcAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": []
    },
    {
      "name": "createMarket",
      "docs": [
        "Open a market. `feed_id_hex` is the Pyth feed id (64 hex chars, optional",
        "0x). `target_price` and `expo` express the strike in fixed point, so a",
        "$200.00 strike on a feed with exponent -5 is target_price 20_000_000,",
        "expo -5. `deadline` is the unix time betting closes and resolve opens.",
        "`market_id` lets one creator run many markets."
      ],
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "marketId",
          "type": "u64"
        },
        {
          "name": "feedIdHex",
          "type": "string"
        },
        {
          "name": "targetPrice",
          "type": "i64"
        },
        {
          "name": "expo",
          "type": "i32"
        },
        {
          "name": "deadline",
          "type": "i64"
        }
      ]
    },
    {
      "name": "resolve",
      "docs": [
        "Resolve the market after its deadline. Reads the Pyth price update account",
        "with a staleness cap and a feed id binding, then sets the winning side by",
        "comparing the settled price to the target in fixed point. Permissionless:",
        "anyone can resolve once a fresh price update is posted."
      ],
      "discriminator": [
        246,
        150,
        236,
        206,
        108,
        63,
        58,
        10
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "priceUpdate",
          "docs": [
            "The Pyth price update account. Anchor verifies it is owned by the Pyth",
            "receiver program automatically and get_price_no_older_than binds it to",
            "this market's feed id."
          ]
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "betAccount",
      "discriminator": [
        117,
        187,
        165,
        174,
        194,
        28,
        119,
        76
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6002,
      "name": "invalidSide",
      "msg": "Invalid side, use 0 for NO or 1 for YES"
    },
    {
      "code": 6003,
      "name": "deadlineInPast",
      "msg": "Deadline must be in the future"
    },
    {
      "code": 6004,
      "name": "bettingClosed",
      "msg": "Betting is closed for this market"
    },
    {
      "code": 6005,
      "name": "alreadyResolved",
      "msg": "Market is already resolved"
    },
    {
      "code": 6006,
      "name": "deadlineNotReached",
      "msg": "Market deadline has not passed yet"
    },
    {
      "code": 6007,
      "name": "notResolved",
      "msg": "Market is not resolved yet"
    },
    {
      "code": 6008,
      "name": "alreadyClaimed",
      "msg": "This bet is already claimed"
    },
    {
      "code": 6009,
      "name": "notAWinner",
      "msg": "This bet is not on the winning side"
    },
    {
      "code": 6010,
      "name": "sideMismatch",
      "msg": "A bet is already placed on the other side"
    },
    {
      "code": 6011,
      "name": "noWinners",
      "msg": "No winning stake to pay from"
    },
    {
      "code": 6012,
      "name": "wrongUsdcMint",
      "msg": "USDC mint does not match the market"
    },
    {
      "code": 6013,
      "name": "betOwnerMismatch",
      "msg": "Bet owner does not match the signer"
    },
    {
      "code": 6014,
      "name": "betMarketMismatch",
      "msg": "Bet does not belong to this market"
    }
  ],
  "types": [
    {
      "name": "betAccount",
      "docs": [
        "One user's bet in one market."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "market",
      "docs": [
        "A single prediction market."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "pythFeedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "targetPrice",
            "type": "i64"
          },
          {
            "name": "expo",
            "type": "i32"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "resolved",
            "type": "bool"
          },
          {
            "name": "winningSide",
            "type": "u8"
          },
          {
            "name": "totalYes",
            "type": "u64"
          },
          {
            "name": "totalNo",
            "type": "u64"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "escrowBump",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "priceFeedMessage",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "docs": [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "publishTime",
            "docs": [
              "The timestamp of this price update in seconds"
            ],
            "type": "i64"
          },
          {
            "name": "prevPublishTime",
            "docs": [
              "The timestamp of the previous price update. This field is intended to allow users to",
              "identify the single unique price update for any moment in time:",
              "for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.",
              "",
              "Note that there may not be such an update while we are migrating to the new message-sending logic,",
              "as some price updates on pythnet may not be sent to other chains (because the message-sending",
              "logic may not have triggered). We can solve this problem by making the message-sending mandatory",
              "(which we can do once publishers have migrated over).",
              "",
              "Additionally, this field may be equal to publish_time if the message is sent on a slot where",
              "where the aggregation was unsuccesful. This problem will go away once all publishers have",
              "migrated over to a recent version of pyth-agent."
            ],
            "type": "i64"
          },
          {
            "name": "emaPrice",
            "type": "i64"
          },
          {
            "name": "emaConf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "priceUpdateV2",
      "docs": [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "writeAuthority",
            "type": "pubkey"
          },
          {
            "name": "verificationLevel",
            "type": {
              "defined": {
                "name": "verificationLevel"
              }
            }
          },
          {
            "name": "priceMessage",
            "type": {
              "defined": {
                "name": "priceFeedMessage"
              }
            }
          },
          {
            "name": "postedSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "verificationLevel",
      "docs": [
        "Pyth price updates are bridged to all blockchains via Wormhole.",
        "Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.",
        "The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,",
        "so we also allow for partial verification.",
        "",
        "This enum represents how much a price update has been verified:",
        "- If `Full`, we have verified the signatures for two thirds of the current guardians.",
        "- If `Partial`, only `num_signatures` guardian signatures have been checked.",
        "",
        "# Warning",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "partial",
            "fields": [
              {
                "name": "numSignatures",
                "type": "u8"
              }
            ]
          },
          {
            "name": "full"
          }
        ]
      }
    }
  ]
};
