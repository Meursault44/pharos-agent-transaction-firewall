---
name: pharos-agent-transaction-firewall
description: Pre-execution safety firewall for AI agents on Pharos Atlantic testnet and Pharos mainnet. Use when an agent or user wants to inspect a transaction before signing or sending it, decode calldata, classify approvals/transfers/admin calls, detect unlimited approvals, unknown spenders, risky token interactions, suspicious value transfers, or decide whether an onchain action should be ALLOW, WARN, or BLOCK.
---

# Pharos Agent Transaction Firewall

Use this skill as a pre-signing safety layer for AI agents on Pharos. It inspects a proposed transaction or an existing transaction hash and returns a policy decision: `ALLOW`, `WARN`, or `BLOCK`.

This skill is read-only. It never asks for a private key and never sends transactions.

The implementation is written in TypeScript at `scripts/inspect-transaction.ts`. If `dist/inspect-transaction.js` is missing or stale, run `npm install` and `npm run build` before using the compiled CLI.

## Inputs

Support either:

- Proposed transaction: `--to <ADDRESS> --data <CALLDATA> --value <WEI_OR_ETH>`.
- Existing transaction: `--tx <TX_HASH>`.

Optional:

- `--from <ADDRESS>` to include sender context.
- `--network atlantic-testnet` or `--network mainnet`; default to `atlantic-testnet`.
- `--value-eth <AMOUNT>` for human-friendly native value input.

Use `mainnet` for Pharos Pacific Mainnet / chain `1672`.

## Fast Path

Prepare the TypeScript build:

```bash
npm install
npm run build
```

Inspect a proposed ERC20 approval:

```bash
node dist/inspect-transaction.js --network mainnet --to <TOKEN_ADDRESS> --data <CALLDATA>
```

Inspect an already submitted transaction:

```bash
node dist/inspect-transaction.js --network mainnet --tx <TX_HASH>
```

Use fixture demos:

```bash
node dist/inspect-transaction.js --fixture unlimited-approval
node dist/inspect-transaction.js --fixture safe-transfer
```

## Decision Policy

Return:

- `ALLOW`: normal interaction with low static risk.
- `WARN`: unknown contract, nonzero value transfer, limited approval, admin call, unverified risk, or incomplete decoding.
- `BLOCK`: unlimited approval to an unknown spender, transaction to an EOA with calldata, no target contract for a contract call, native value plus unknown calldata, known dangerous selector, or obviously malformed calldata.

Do not present the decision as a guarantee. Explain what was decoded and what the user or agent should verify next.

## Workflow

1. Resolve network RPC from local `assets/networks.json` when available, otherwise from `pharos-skill-engine/assets/networks.json`.
2. If `--tx` is provided, fetch transaction data with `eth_getTransactionByHash`.
3. Validate addresses, value, and calldata.
4. Fetch target bytecode and identify whether `to` is an EOA or contract.
5. Decode known selectors:
   - ERC20: `approve`, `transfer`, `transferFrom`.
   - ERC721/ERC1155: `setApprovalForAll`, `safeTransferFrom`.
   - ownership/admin: `transferOwnership`, `renounceOwnership`, `pause`, `unpause`.
   - DEX-like calls: common swap selectors.
6. For approvals, inspect spender bytecode and known-token status.
7. Detect unlimited approvals and suspicious patterns.
8. Produce a structured JSON report with:
   - `decision`
   - `severity`
   - decoded action
   - positive signals
   - warning/block reasons
   - recommended next step

For policy details, read `references/firewall-policy.md`.
