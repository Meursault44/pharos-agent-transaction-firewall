# 🛡️ Pharos Agent Transaction Firewall

**Pre-execution safety firewall for AI agents on Pharos.**

Before an AI agent signs or sends an onchain transaction, this skill inspects the transaction, decodes calldata, identifies what the action will do, checks the target and spender contracts, detects dangerous patterns, and returns a clear decision:

```text
✅ ALLOW / ⚠️ WARN / 🛑 BLOCK
```

The core idea is simple: **AI agents should not blindly execute onchain actions.**  
They need a guardrail that can understand intent, explain risk, and stop dangerous transactions before signing.

---

## ✨ What It Does

Pharos Agent Transaction Firewall acts as a **pre-signing security layer** for AI-native onchain workflows.

It can:

- 🛑 Block unlimited ERC20 approvals to unknown spenders.
- ⚠️ Warn before token transfers, native value transfers, and unknown calls.
- 🔎 Decode common calldata patterns into plain English.
- 🧠 Classify approvals, transfers, swaps, admin calls, and unknown selectors.
- 🏗️ Check whether the target address is a smart contract or an EOA.
- 👀 Inspect spender/operator contracts before approving them.
- 📜 Analyze proposed transactions or already submitted transaction hashes.
- 🔐 Run fully read-only: no private keys, no signatures, no transaction sending.

---

## 🚀 Why This Skill Matters

Pharos Agent Centre lets AI agents interact with onchain environments through natural language and structured Skills.

That is powerful, but it also creates a new safety problem:

> If an AI agent can approve, swap, transfer, deploy, or automate onchain actions, it needs a transaction firewall before execution.

This skill is designed for exactly that moment:

```text
User intent → Agent prepares transaction → Firewall inspects it → ALLOW / WARN / BLOCK
```

It is not just a transaction decoder.  
It is a **policy layer for AI agents before signing**.

---

## 🌐 Supported Networks

| Network | Chain ID | Status |
| --- | ---: | --- |
| Pharos Pacific Mainnet | `1672` | ✅ Supported |
| Pharos Atlantic Testnet | `688689` | ✅ Supported |

Network configuration lives in:

```text
assets/networks.json
```

---

## 🧩 Supported Inspection Types

The firewall currently decodes and classifies:

| Category | Supported Actions |
| --- | --- |
| ERC20 | `approve`, `transfer`, `transferFrom` |
| NFT / Multi-token | `setApprovalForAll`, `safeTransferFrom` |
| Admin controls | `transferOwnership`, `renounceOwnership`, `mint`, `pause`, `unpause` |
| DEX-like activity | Common swap selectors |
| Native transfers | Value transfer warnings |
| Unknown calls | Unknown selector detection |
| Target checks | Contract vs EOA detection |
| Spender checks | Contract existence for approval spenders/operators |

---

## 🧠 Decision Model

### ✅ ALLOW

No major static red flags were detected.

Typical cases:

- Decoded action is low-risk.
- Target contract exists.
- No suspicious approval or admin behavior was found.

### ⚠️ WARN

The action may be legitimate, but the agent should ask the user for explicit confirmation.

Typical cases:

- Token transfer.
- Limited ERC20 approval.
- Native value transfer.
- Unknown function selector.
- Unknown target token or contract.

### 🛑 BLOCK

The transaction has a strong static danger signal.

Typical cases:

- Unlimited ERC20 approval to an unknown spender.
- NFT `setApprovalForAll(..., true)` to an unknown operator.
- Calldata sent to an address with no contract code.
- Native value sent together with unknown calldata.
- Admin/destructive function call without explicit intent.

---

## 📦 Installation

Clone the repository:

```bash
git clone https://github.com/Meursault44/pharos-agent-transaction-firewall.git
cd pharos-agent-transaction-firewall
```

No dependency installation is required.  
The skill uses Node.js built-in APIs.

Requirements:

```text
Node.js 18+
```

---

## ⚡ Quick Start

Inspect a proposed transaction:

```bash
node scripts/inspect-transaction.js --network mainnet --to <TARGET_ADDRESS> --data <CALLDATA>
```

Inspect a proposed transaction with native value:

```bash
node scripts/inspect-transaction.js --network mainnet --to <TARGET_ADDRESS> --data <CALLDATA> --value <VALUE_IN_WEI>
```

Inspect an existing transaction hash:

```bash
node scripts/inspect-transaction.js --network mainnet --tx <TX_HASH>
```

Use Atlantic testnet:

```bash
node scripts/inspect-transaction.js --network atlantic-testnet --to <TARGET_ADDRESS> --data <CALLDATA>
```

---

## 🎬 Demo

### 🛑 Demo 1: Dangerous Unlimited Approval

Run:

```bash
node scripts/inspect-transaction.js --fixture unlimited-approval
```

Expected result:

```text
🛑 BLOCK
```

Reason:

```text
Unlimited approval to EOA/unknown spender
```

### ⚠️ Demo 2: Token Transfer

Run:

```bash
node scripts/inspect-transaction.js --fixture safe-transfer
```

Expected result:

```text
⚠️ WARN
```

Reason:

```text
Token transfer detected. Ask the user to confirm the decoded action.
```

You can also run the npm shortcuts:

```bash
npm run demo:block
npm run demo:warn
```

On Windows PowerShell, if `npm.ps1` is blocked by execution policy, use:

```powershell
npm.cmd run demo:block
npm.cmd run demo:warn
```

---

## 📤 Example Output

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

---

## 🤖 AI Agent Prompt Examples

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

---

## 🗂️ Repository Structure

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
|-- scripts/
|   `-- inspect-transaction.js
|-- package.json
|-- README.md
`-- LICENSE
```

---

## 🔐 Safety Notes

This skill is intentionally read-only.

- ✅ No private keys.
- ✅ No wallet connection.
- ✅ No signatures.
- ✅ No transaction sending.
- ✅ No write operations.
- ✅ Uses Pharos RPC only for transaction, code, and network inspection.

The firewall provides static pre-execution analysis. It does **not** guarantee that a transaction is safe. It should be used as a guardrail before manual confirmation or agent execution.

---

## 🏆 Pharos Skill Builder Campaign Submission

### Skill Name

```text
Pharos Agent Transaction Firewall
```

### Brief Description

```text
Pharos Agent Transaction Firewall is a pre-execution safety layer for AI agents on Pharos.

Before an agent signs or sends an onchain transaction, the skill decodes calldata, identifies approvals, transfers, swaps, admin calls, and unknown selectors, checks target and spender contracts, detects dangerous patterns like unlimited approvals, and returns a clear ALLOW / WARN / BLOCK decision with a plain-English explanation.

It is designed for AI-native onchain workflows where agents need guardrails before execution.
```

### GitHub Link

```text
https://github.com/Meursault44/pharos-agent-transaction-firewall
```

### Demo Commands

```bash
node scripts/inspect-transaction.js --fixture unlimited-approval
node scripts/inspect-transaction.js --fixture safe-transfer
```

### Supported Framework

```text
Pharos Skill Engine
Node.js 18+
Pharos Pacific Mainnet
Pharos Atlantic Testnet
```

### Extra Notes / Dependencies

```text
Read-only by design.
No private key required.
No signing.
No transaction sending.
No wallet connection required.
Built as an AI-agent guardrail before onchain execution.
```
