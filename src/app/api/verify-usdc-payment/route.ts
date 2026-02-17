import { NextRequest, NextResponse } from "next/server";
import { verifyUsdcPayment } from "@/lib/verifyPayment";

export async function POST(req: NextRequest) {
  try {
    const { transactionSignature, trackId } = await req.json();
    if (!transactionSignature || typeof transactionSignature !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid transactionSignature" },
        { status: 400 }
      );
    }

    const verification = await verifyUsdcPayment(transactionSignature);
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: verification.error ?? "Invalid payment" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      trackId: trackId ?? null,
    });
  } catch (error) {
    console.error("Verify USDC payment error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Payment verification failed",
      },
      { status: 500 }
    );
  }
}
