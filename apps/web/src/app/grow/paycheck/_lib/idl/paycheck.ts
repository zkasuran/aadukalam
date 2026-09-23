/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/paycheck.json`.
 */
export type Paycheck = {
  "address": "9DAHUC1KQUsBMB9cQk8EdVZfKAhVukLhUsyuQYZBLgAy",
  "metadata": {
    "name": "paycheck",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "Paycheck turns a tokenized-stock rebase into a claimable USDC dividend.",
    "",
    "Flow. A holder deposits a rebasing stock token into a program vault and the",
    "program records the principal. A keeper watches the rebase off chain, works",
    "out the USDC value of each rebase delta from the multiplier and the price, then",
    "calls record_rebase to credit the holder. The holder later claims the accrued",
    "USDC from the vault. Every transfer uses checked math and no handler unwraps.",
    "",
    "On devnet this stands in for the mainnet xStocks rebase, which is issuer",
    "driven. The mechanism is the same, the numbers are labeled as a devnet",
    "simulation in the app."
  ],
  "instructions": [
    {
      "name": "claim",
      "docs": [
        "Claim the full accrued USDC balance from the vault to the holder, then",
        "zero it. Signed by the vault authority PDA."
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
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "vaultAuthority"
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "ownerUsdcAta",
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
      "name": "deposit",
      "docs": [
        "Deposit `amount` of a stock token into the vault and record it as",
        "principal. The first deposit for a (holder, mint) pair opens the position",
        "at a 1.0x baseline multiplier. Later deposits add to the principal."
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "stockMint"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "vaultAuthority"
        },
        {
          "name": "ownerStockAta",
          "writable": true
        },
        {
          "name": "stockVault",
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
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "One time setup. Create the config PDA and the program owned USDC vault.",
        "The signer becomes the admin. `keeper` is the only authority allowed to",
        "post rebase credits. `usdc_mint` is the dividend mint the vault pays out."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vaultAuthority",
          "docs": [
            "authority so it carries no data and is validated by its seeds."
          ]
        },
        {
          "name": "usdcVault",
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
      "args": [
        {
          "name": "keeper",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "recordRebase",
      "docs": [
        "Keeper only. Credit `dividend_usdc` to a holder's claimable balance and",
        "record the multiplier that produced it. The keeper computes the USDC",
        "figure off chain from the rebase multiplier delta and the price. The",
        "program trusts the keeper for that figure and only guards the arithmetic."
      ],
      "discriminator": [
        90,
        145,
        160,
        6,
        112,
        182,
        147,
        168
      ],
      "accounts": [
        {
          "name": "keeper",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "position",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "user",
          "type": "pubkey"
        },
        {
          "name": "dividendUsdc",
          "type": "u64"
        },
        {
          "name": "newMultiplierBps",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "userPosition",
      "discriminator": [
        251,
        248,
        209,
        245,
        83,
        234,
        17,
        27
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
      "name": "unauthorizedKeeper",
      "msg": "Signer is not the configured keeper"
    },
    {
      "code": 6003,
      "name": "positionOwnerMismatch",
      "msg": "Position owner does not match the given user"
    },
    {
      "code": 6004,
      "name": "wrongUsdcMint",
      "msg": "USDC mint does not match the config"
    },
    {
      "code": 6005,
      "name": "nothingToClaim",
      "msg": "Nothing to claim"
    }
  ],
  "types": [
    {
      "name": "config",
      "docs": [
        "Program config. Holds the admin, the keeper allowed to post rebase credits,",
        "and the USDC mint the vault pays out."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "keeper",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userPosition",
      "docs": [
        "One holder's position in one deposited stock mint."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "depositedStockMint",
            "type": "pubkey"
          },
          {
            "name": "principal",
            "type": "u64"
          },
          {
            "name": "claimableUsdc",
            "type": "u64"
          },
          {
            "name": "lastMultiplierBps",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
