# Firewall Policy

Use this policy to explain `ALLOW`, `WARN`, and `BLOCK` decisions.

## BLOCK

Block when a transaction has a strong static danger signal:

- Unlimited ERC20 approval to an unknown spender.
- `setApprovalForAll(..., true)` to an unknown operator.
- Calldata sent to an address with no contract code.
- Nonzero native value sent with unknown calldata.
- Malformed calldata or invalid transaction fields.
- Known admin or destructive selectors in a context where the user did not explicitly request them.

## WARN

Warn when the transaction may be legitimate but deserves confirmation:

- Limited ERC20 approval.
- Transfer to an unknown address.
- Contract exists but selector is unknown.
- Target is not in the local known-token list.
- Spender/operator is a contract but not recognized.
- Native value transfer above dust size.
- Existing transaction hash is pending or missing receipt context.

## ALLOW

Allow when the action is decoded and no strong static warning is present:

- Simple ERC20 transfer with valid recipient and amount.
- Interaction with a known local Pharos token without risky approval behavior.
- Zero-value contract call with known benign selector.

## Report Wording

Use agent-safety language:

- "Firewall decision: BLOCK. Do not sign this transaction without manual review."
- "Firewall decision: WARN. Ask the user to confirm this risk."
- "Firewall decision: ALLOW. No major static red flags were detected."

Avoid absolute claims:

- Do not say a transaction is guaranteed safe.
- Do not say a contract is malicious without proof.
