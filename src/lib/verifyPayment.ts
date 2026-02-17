import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MIN_AMOUNT_RAW = 500_000;

export async function verifyUsdcPayment(
  transactionSignature: string
): Promise<{ valid: boolean; error?: string }> {
  const treasuryWallet = process.env.TREASURY_WALLET;
  const rpcUrl =
    process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  if (!treasuryWallet) {
    return { valid: false, error: "TREASURY_WALLET not configured" };
  }

  const connection = new Connection(rpcUrl);
  // Tx can take a few seconds to appear in RPC; retry a few times
  let tx: Awaited<ReturnType<Connection["getParsedTransaction"]>> = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    tx = await connection.getParsedTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
    });
    if (tx) break;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
  }

  if (!tx) {
    return { valid: false, error: "Transaction not found yet. Wait a minute and try again." };
  }
  if (tx.meta?.err) {
    return { valid: false, error: "Transaction failed on-chain" };
  }

  const treasuryPubkey = new PublicKey(treasuryWallet);
  const usdcMint = new PublicKey(USDC_MINT_MAINNET);
  const treasuryUsdcAta = getAssociatedTokenAddressSync(
    usdcMint,
    treasuryPubkey
  );
  const treasuryUsdcAtaStr = treasuryUsdcAta.toBase58();

  const instructions =
    (tx as ParsedTransactionWithMeta).transaction?.message?.instructions ?? [];

  for (const ix of instructions) {
    if ("parsed" in ix && ix.parsed && typeof ix.parsed === "object") {
      const parsed = ix.parsed as {
        type?: string;
        info?: {
          amount?: string;
          destination?: string;
          tokenAmount?: { amount: string };
        };
      };
      const isTransfer =
        parsed.type === "transfer" || parsed.type === "transferChecked";
      if (isTransfer && parsed.info?.destination === treasuryUsdcAtaStr) {
        const amount =
          parsed.type === "transferChecked" && parsed.info?.tokenAmount
            ? Number(parsed.info.tokenAmount.amount)
            : parsed.info?.amount
              ? Number(parsed.info.amount)
              : 0;
        if (amount >= MIN_AMOUNT_RAW) {
          return { valid: true };
        }
      }
    }
  }

  return {
    valid: false,
    error: "No valid USDC transfer of at least 0.50 to treasury found",
  };
}
