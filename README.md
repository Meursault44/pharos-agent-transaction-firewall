# Pharos Agent Transaction Firewall

Pre-execution safety firewall for AI agents on Pharos.

Before an AI agent signs or sends an onchain transaction, this skill decodes the calldata, identifies the action, checks the target and spender contracts, detects dangerous patterns such as unlimited approvals, and returns a clear policy decision:

```text
ALLOW / WARN / BLOCK
```

The goal is simple: AI agents should not blindly execute transactions. They need a safety layer that can inspect intent, explain risk, and stop obviously dangerous actions before signing.

## Why This Skill Matters

Pharos Agent Centre enables AI agents to interact with onchain environments through natural language and structured skills. As agents gain the ability to query, approve, swap, transfer, deploy, and automate actions, they also need guardrails.

This skill acts as a pre-signing firewall for Pharos:

- Blocks unlimited approvals to unknown spenders.
- Warns before token transfers and unknown contract calls.
- Detects admin-level calls such as ownership transfer, mint, pause, and unpause.
- Checks whether the target address is a contract or an EOA.
- Supports proposed transactions and already submitted transaction hashes.
- Works without private keys, signatures, or write access.

## Supported Networks

- Pharos Pacific Mainnet, chain ID `1672`
- Pharos Atlantic Testnet, chain ID `688689`

Network configuration is stored in `assets/networks.json`.

## What It Can Inspect

The firewall currently decodes and classifies:

- ERC20 `approve(address,uint256)`
- ERC20 `transfer(address,uint256)`
- ERC20 `transferFrom(address,address,uint256)`
- ERC721/ERC1155 `setApprovalForAll(address,bool)`
- ERC721 `safeTransferFrom(address,address,uint256)`
- Admin calls such as `transferOwnership`, `renounceOwnership`, `mint`, `pause`, and `unpause`
- Common DEX-like swap selectors
- Unknown selectors and malformed calldata
- Native value transfers

## Decision Model

### ALLOW

No major static red flags were detected.

Example:

- Known low-risk zero-value contract call
- Decoded action matches expected user intent

### WARN

The action may be legitimate, but the agent should ask for explicit confirmation.

Examples:

- Token transfer
- Limited ERC20 approval
- Unknown function selector
- Native value transfer
- Unknown target token

### BLOCK

The transaction has a strong static danger signal.

Examples:

- Unlimited ERC20 approval to an unknown spender
- NFT `setApprovalForAll(..., true)` to an unknown operator
- Calldata sent to an address with no contract code
- Nonzero native value plus unknown calldata
- Admin/destructive function call without explicit intent

## Installation

Clone this repository:

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd pharos-agent-transaction-firewall
```

No npm install is required. The skill uses Node.js built-in APIs.

Requirements:

- Node.js 18+

## Usage

Inspect a proposed transaction:

```bash
node scripts/inspect-transaction.js --network mainnet --to <TARGET_ADDRESS> --data <CALLDATA>
```

Inspect a proposed transaction with native value:

```bash
node scripts/inspect-transaction.js --network mainnet --to <TARGET_ADDRESS> --data <CALLDATA> --value <VALUE_IN_WEI>
```

Inspect an already submitted transaction:

```bash
node scripts/inspect-transaction.js --network mainnet --tx <TX_HASH>
```

Use Atlantic testnet:

```bash
node scripts/inspect-transaction.js --network atlantic-testnet --to <TARGET_ADDRESS> --data <CALLDATA>
```

## Demo Commands

Run a dangerous unlimited approval demo:

```bash
node scripts/inspect-transaction.js --fixture unlimited-approval
```

Expected decision:

```text
BLOCK
```

Reason:

```text
Unlimited approval to EOA/unknown spender
```

Run a token transfer demo:

```bash
node scripts/inspect-transaction.js --fixture safe-transfer
```

Expected decision:

```text
WARN
```

Reason:

```text
Token transfer detected. Ask the user to confirm the decoded action.
```

## Example Output

```json
{
  "network": "mainnet",
  "to": "0x0a764846f1721feb3fb1e7d79130eb82c324dd64",
  "decodedAction": {
    "selector": "095ea7b3",
    "name": "approve",
    "type": "erc20-approval",
    "args": {
      "spender": "0x1111111111111111111111111111111111111111",
      "amount": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    }
  },
  "decision": "BLOCK",
  "severity": "high",
  "blocks": [
    "Unlimited approval to EOA/unknown spender: 0x1111111111111111111111111111111111111111"
  ],
  "nextStep": "Do not sign this transaction until the target, spender, calldata, and user intent are manually verified."
}
```

## AI Agent Prompt Examples

```text
Use $pharos-agent-transaction-firewall to inspect this transaction before signing:
to = 0x...
data = 0x...
network = mainnet
```

```text
Use $pharos-agent-transaction-firewall to decode this Pharos transaction hash and tell me whether an agent should allow, warn, or block it.
```

```text
Before approving this token spend, run the Pharos Agent Transaction Firewall and explain the risk in plain English.
```

## Skill Structure

```text
.
|-- SKILL.md
|-- agents/
|   `-- openai.yaml
|-- assets/
|   |-- networks.json
|   `-- tokens.json
|-- fixtures/
|   |-- safe-transfer.json
|   `-- unlimited-approval.json
|-- references/
|   `-- firewall-policy.md
`-- scripts/
    `-- inspect-transaction.js
```

## Safety Notes

- Read-only by design.
- No private keys.
- No signatures.
- No transaction sending.
- No wallet connection required.
- Uses Pharos RPC only for transaction, code, and network inspection.

The firewall provides static pre-execution analysis. It does not guarantee that a transaction is safe, and it should be used as a guardrail before manual confirmation or agent execution.

## Campaign Submission

Skill name:

```text
Pharos Agent Transaction Firewall
```

Short description:

```text
A pre-execution safety firewall for AI agents on Pharos. Before an agent signs or sends a transaction, the skill decodes calldata, identifies approvals, transfers, swaps, and admin calls, checks target and spender contracts, detects dangerous patterns like unlimited approvals, and returns an ALLOW, WARN, or BLOCK decision with a plain-English explanation.
```

Supported framework:

```text
Pharos Skill Engine, Node.js, Pharos Pacific Mainnet, Pharos Atlantic Testnet
```

Extra notes:

```text
Read-only. No private key required. No signing or transaction sending. Designed as an AI-agent guardrail before onchain execution.
```
