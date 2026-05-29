#!/usr/bin/env node

import fs from "fs";
import path from "path";

type FirewallDecision = "ALLOW" | "WARN" | "BLOCK";
type Severity = "low" | "medium" | "high" | "unknown";
type SelectorArgType = "address" | "uint256" | "bool";
type DecodedArgValue = string | boolean;

interface CliArgs {
  [key: string]: string | true | undefined;
  data?: string;
  fixture?: string;
  from?: string;
  network?: string;
  to?: string;
  tx?: string;
  value?: string;
  "value-eth"?: string;
  "rpc-url"?: string;
}

interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId?: number;
  explorerUrl?: string;
  explorerApiUrl?: string;
  nativeToken?: string;
}

interface NetworksFile {
  networks: NetworkConfig[];
  defaultNetwork?: string;
}

interface KnownToken {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

type TokensFile = Record<string, KnownToken[]>;

interface ResolvedConfig {
  network: NetworkConfig;
  rpcUrl: string;
  knownTokens: KnownToken[];
}

interface RpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface RpcTransaction {
  from: string;
  to: string | null;
  input: string;
  value: string;
}

interface SelectorDefinition {
  name: string;
  type:
    | "erc20-approval"
    | "erc20-transfer"
    | "erc20-transfer-from"
    | "nft-operator-approval"
    | "erc721-safe-transfer"
    | "admin"
    | "dex-swap";
  args: SelectorArgType[];
}

interface DecodedAction {
  selector: string | null;
  name: string;
  type:
    | SelectorDefinition["type"]
    | "native-transfer"
    | "unknown-call";
  args: Record<string, DecodedArgValue>;
}

interface CodeInfo {
  hasCode: boolean;
  codeSizeBytes: number;
}

interface SpenderInfo extends CodeInfo {
  address: string;
}

const MAX_UINT256 = (1n << 256n) - 1n;
const HIGH_APPROVAL_THRESHOLD = 10n ** 30n;

const SELECTORS: Record<string, SelectorDefinition> = {
  "095ea7b3": { name: "approve", type: "erc20-approval", args: ["address", "uint256"] },
  a9059cbb: { name: "transfer", type: "erc20-transfer", args: ["address", "uint256"] },
  "23b872dd": { name: "transferFrom", type: "erc20-transfer-from", args: ["address", "address", "uint256"] },
  a22cb465: { name: "setApprovalForAll", type: "nft-operator-approval", args: ["address", "bool"] },
  "42842e0e": { name: "safeTransferFrom", type: "erc721-safe-transfer", args: ["address", "address", "uint256"] },
  f2fde38b: { name: "transferOwnership", type: "admin", args: ["address"] },
  "715018a6": { name: "renounceOwnership", type: "admin", args: [] },
  "8456cb59": { name: "pause", type: "admin", args: [] },
  "3f4ba83a": { name: "unpause", type: "admin", args: [] },
  "40c10f19": { name: "mint", type: "admin", args: ["address", "uint256"] },
  "022c0d9f": { name: "swap", type: "dex-swap", args: [] },
  "414bf389": { name: "exactInputSingle", type: "dex-swap", args: [] },
  b858183f: { name: "exactInput", type: "dex-swap", args: [] },
  "04e45aaf": { name: "exactInputSingle", type: "dex-swap", args: [] },
  "5023b4df": { name: "exactOutputSingle", type: "dex-swap", args: [] },
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    const next = argv[i + 1];
    args[key.slice(2)] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return args;
}

function stringArg(value: string | true | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isAddress(value: string | null | undefined): value is string {
  return /^0x[a-fA-F0-9]{40}$/.test(value || "");
}

function isTxHash(value: string | undefined): value is string {
  return /^0x[a-fA-F0-9]{64}$/.test(value || "");
}

function normalizeHex(value: string | undefined): string {
  if (!value || value === "0x") return "0x";
  if (!/^0x[0-9a-fA-F]*$/.test(value)) throw new Error(`Invalid hex data: ${value}`);
  if (value.length % 2 !== 0) throw new Error("Hex data must have an even number of characters");
  return value.toLowerCase();
}

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function resolveConfig(networkName: string | undefined, rpcOverride: string | undefined): ResolvedConfig {
  const candidateAssetDirs = [
    path.join(__dirname, "..", "assets"),
    path.join(__dirname, "..", "..", "assets"),
    path.join(__dirname, "..", "..", "pharos-skill-engine", "assets"),
  ];
  const assetsDir = candidateAssetDirs.find((dir) =>
    fs.existsSync(path.join(dir, "networks.json")) && fs.existsSync(path.join(dir, "tokens.json"))
  );
  if (!assetsDir) throw new Error("Missing assets/networks.json and assets/tokens.json");

  const networks = loadJson<NetworksFile>(path.join(assetsDir, "networks.json"));
  const tokens = loadJson<TokensFile>(path.join(assetsDir, "tokens.json"));
  const selected = networkName || networks.defaultNetwork || "atlantic-testnet";
  const network = networks.networks.find((item) => item.name === selected);
  if (!network && !rpcOverride) throw new Error(`Unsupported network: ${selected}`);

  return {
    network: network || { name: selected, rpcUrl: rpcOverride as string },
    rpcUrl: rpcOverride || (network as NetworkConfig).rpcUrl,
    knownTokens: tokens[selected] || [],
  };
}

async function rpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const json = (await response.json()) as RpcResponse<T>;
  if (json.error) throw new Error(`${json.error.code}: ${json.error.message}`);
  return json.result as T;
}

function word(data: string, index: number): string {
  const clean = data.replace(/^0x/, "");
  const start = 8 + index * 64;
  const value = clean.slice(start, start + 64);
  if (value.length < 64) throw new Error("Calldata is too short for selector arguments");
  return value;
}

function decodeAddressWord(hexWord: string): string {
  return `0x${hexWord.slice(24)}`;
}

function decodeUintWord(hexWord: string): string {
  return BigInt(`0x${hexWord}`).toString();
}

function decodeBoolWord(hexWord: string): boolean {
  return BigInt(`0x${hexWord}`) !== 0n;
}

function decodeCalldata(data: string): DecodedAction {
  const normalized = normalizeHex(data);
  if (normalized === "0x") {
    return { selector: null, name: "nativeTransfer", type: "native-transfer", args: {} };
  }
  if (normalized.length < 10) throw new Error("Calldata is shorter than a function selector");

  const selector = normalized.slice(2, 10);
  const known = SELECTORS[selector];
  if (!known) return { selector, name: "unknown", type: "unknown-call", args: {} };

  const decoded: DecodedAction = { selector, name: known.name, type: known.type, args: {} };
  known.args.forEach((argType, index) => {
    const value = word(normalized, index);
    if (argType === "address") decoded.args[`arg${index}`] = decodeAddressWord(value);
    else if (argType === "uint256") decoded.args[`arg${index}`] = decodeUintWord(value);
    else if (argType === "bool") decoded.args[`arg${index}`] = decodeBoolWord(value);
  });

  if (known.type === "erc20-approval") {
    decoded.args.spender = decoded.args.arg0;
    decoded.args.amount = decoded.args.arg1;
    delete decoded.args.arg0;
    delete decoded.args.arg1;
  } else if (known.type === "erc20-transfer") {
    decoded.args.recipient = decoded.args.arg0;
    decoded.args.amount = decoded.args.arg1;
    delete decoded.args.arg0;
    delete decoded.args.arg1;
  } else if (known.type === "erc20-transfer-from") {
    decoded.args.owner = decoded.args.arg0;
    decoded.args.recipient = decoded.args.arg1;
    decoded.args.amount = decoded.args.arg2;
    delete decoded.args.arg0;
    delete decoded.args.arg1;
    delete decoded.args.arg2;
  } else if (known.type === "nft-operator-approval") {
    decoded.args.operator = decoded.args.arg0;
    decoded.args.approved = decoded.args.arg1;
    delete decoded.args.arg0;
    delete decoded.args.arg1;
  } else if (known.type === "admin" && known.args[0] === "address") {
    decoded.args.newOwnerOrTarget = decoded.args.arg0;
    delete decoded.args.arg0;
  }

  return decoded;
}

function parseValue(args: CliArgs, tx: RpcTransaction | null): string {
  const valueEth = stringArg(args["value-eth"]);
  if (valueEth) {
    const [whole, fraction = ""] = valueEth.split(".");
    return (BigInt(whole || "0") * 10n ** 18n + BigInt(fraction.padEnd(18, "0").slice(0, 18) || "0")).toString();
  }

  const raw = stringArg(args.value) ?? tx?.value ?? "0";
  if (raw.startsWith("0x")) return BigInt(raw).toString();
  return BigInt(raw || "0").toString();
}

function add(list: string[], title: string, detail?: string | null): void {
  list.push(detail ? `${title}: ${detail}` : title);
}

function knownTokenFor(knownTokens: KnownToken[], address: string): KnownToken | null {
  return knownTokens.find((item) => item.address.toLowerCase() === address.toLowerCase()) || null;
}

async function codeInfo(rpcUrl: string, address: string | null | undefined): Promise<CodeInfo> {
  if (!address) return { hasCode: false, codeSizeBytes: 0 };
  const code = await rpc<string>(rpcUrl, "eth_getCode", [address, "latest"]);
  const hasCode = Boolean(code && code !== "0x");
  return { hasCode, codeSizeBytes: hasCode ? (code.length - 2) / 2 : 0 };
}

function loadFixture(name: string): CliArgs {
  const file = path.join(__dirname, "..", "fixtures", `${name}.json`);
  return loadJson<CliArgs>(file);
}

function decodedStringArg(decoded: DecodedAction, key: string): string {
  const value = decoded.args[key];
  if (typeof value !== "string") throw new Error(`Decoded argument ${key} is missing or not a string`);
  return value;
}

async function main(): Promise<void> {
  const rawArgs = parseArgs(process.argv);
  const fixtureName = stringArg(rawArgs.fixture);
  const fixtureArgs = fixtureName ? loadFixture(fixtureName) : {};
  const args: CliArgs = { ...fixtureArgs, ...rawArgs };
  delete args.fixture;

  const txHash = stringArg(args.tx);
  if (!txHash && !args.to) throw new Error("Provide --tx or --to");
  if (txHash && !isTxHash(txHash)) throw new Error("Invalid --tx hash");

  const networkName = stringArg(args.network) || "atlantic-testnet";
  const { network, rpcUrl, knownTokens } = resolveConfig(networkName, stringArg(args["rpc-url"]));

  let tx: RpcTransaction | null = null;
  if (txHash) {
    tx = await rpc<RpcTransaction | null>(rpcUrl, "eth_getTransactionByHash", [txHash]);
    if (!tx) throw new Error("Transaction hash not found on selected network");
  }

  const to = stringArg(args.to) || tx?.to || null;
  const from = stringArg(args.from) || tx?.from || null;
  const data = normalizeHex(stringArg(args.data) || tx?.input || "0x");
  const value = parseValue(args, tx);

  if (!isAddress(to)) throw new Error("Missing or invalid target address");
  if (from && !isAddress(from)) throw new Error("Invalid sender address");

  const decoded = decodeCalldata(data);
  const targetCode = await codeInfo(rpcUrl, to);
  const targetKnownToken = knownTokenFor(knownTokens, to);
  const positives: string[] = [];
  const warnings: string[] = [];
  const blocks: string[] = [];

  if (targetKnownToken) add(positives, "Target is a known Pharos token", targetKnownToken.symbol);
  if (targetCode.hasCode) add(positives, "Target contract exists", `${targetCode.codeSizeBytes} bytes`);
  else if (data !== "0x") add(blocks, "Calldata sent to non-contract address", to);
  else add(warnings, "Target is an EOA", "native transfer or empty call only");

  const nativeValue = BigInt(value);
  if (nativeValue > 0n && data !== "0x" && !targetKnownToken) {
    add(blocks, "Native value with unknown calldata", `${value} wei`);
  } else if (nativeValue > 0n) {
    add(warnings, "Native value transfer", `${value} wei`);
  }

  if (decoded.type === "unknown-call") {
    add(warnings, "Unknown function selector", decoded.selector);
  }

  let spenderInfo: SpenderInfo | null = null;
  if (decoded.type === "erc20-approval") {
    const amount = BigInt(decodedStringArg(decoded, "amount"));
    const spender = decodedStringArg(decoded, "spender");
    spenderInfo = { address: spender, ...(await codeInfo(rpcUrl, spender)) };
    const unlimited = amount === MAX_UINT256 || amount >= HIGH_APPROVAL_THRESHOLD;
    if (unlimited && !spenderInfo.hasCode) {
      add(blocks, "Unlimited approval to EOA/unknown spender", spender);
    } else if (unlimited) {
      add(blocks, "Unlimited approval", `spender ${spender}`);
    } else {
      add(warnings, "ERC20 approval", `spender ${spender}, amount ${amount.toString()}`);
    }
  }

  if (decoded.type === "nft-operator-approval" && decoded.args.approved === true) {
    const operator = decodedStringArg(decoded, "operator");
    spenderInfo = { address: operator, ...(await codeInfo(rpcUrl, operator)) };
    if (!spenderInfo.hasCode) add(blocks, "NFT operator approval to EOA/unknown operator", operator);
    else add(warnings, "NFT operator approval", operator);
  }

  if (decoded.type === "erc20-transfer" || decoded.type === "erc20-transfer-from") {
    add(warnings, "Token transfer detected", JSON.stringify(decoded.args));
  }

  if (decoded.type === "admin") {
    add(blocks, "Admin function detected", decoded.name);
  }

  if (decoded.type === "dex-swap") {
    add(warnings, "DEX-like swap detected", "verify route, slippage, and token risk before signing");
  }

  let decision: FirewallDecision = "ALLOW";
  let severity: Severity = "low";
  if (blocks.length) {
    decision = "BLOCK";
    severity = "high";
  } else if (warnings.length) {
    decision = "WARN";
    severity = "medium";
  }

  const nextStep =
    decision === "BLOCK"
      ? "Do not sign this transaction until the target, spender, calldata, and user intent are manually verified."
      : decision === "WARN"
        ? "Ask the user to confirm the decoded action and verify the target address before signing."
        : "No major static red flags were detected; continue only if the user intended this exact action.";

  console.log(JSON.stringify({
    network: network.name,
    txHash: txHash || null,
    from,
    to,
    valueWei: value,
    target: {
      hasCode: targetCode.hasCode,
      codeSizeBytes: targetCode.codeSizeBytes,
      knownToken: targetKnownToken,
    },
    decodedAction: decoded,
    spenderOrOperator: spenderInfo,
    decision,
    severity,
    positives,
    warnings,
    blocks,
    nextStep,
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ decision: "BLOCK", severity: "unknown", error: message }, null, 2));
  process.exit(1);
});
