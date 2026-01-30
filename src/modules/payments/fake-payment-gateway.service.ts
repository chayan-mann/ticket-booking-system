import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

/**
 * FakePaymentGateway - Simulates a payment gateway like Stripe/Razorpay
 *
 * This service provides:
 * 1. Payment session creation (like Stripe Checkout)
 * 2. Webhook signature verification
 * 3. Configurable success/failure rates for testing
 *
 * In production, replace this with real Stripe/Razorpay SDK
 */

export interface PaymentSession {
  sessionId: string;
  paymentUrl: string;
  expiresAt: Date;
  amount: number;
  currency: string;
  bookingId: string;
  status: "pending" | "completed" | "failed" | "expired";
}

export interface WebhookPayload {
  eventType: "payment.success" | "payment.failed" | "payment.expired";
  sessionId: string;
  bookingId: string;
  amount: number;
  timestamp: number;
  gatewayRef: string;
}

@Injectable()
export class FakePaymentGateway {
  private readonly logger = new Logger(FakePaymentGateway.name);

  // In-memory store for payment sessions (use Redis in production)
  private sessions: Map<string, PaymentSession> = new Map();

  // Webhook secret for signature verification
  private readonly webhookSecret =
    process.env.PAYMENT_WEBHOOK_SECRET || "whsec_fake_secret_12345";

  // Configurable success rate (0-100)
  private readonly successRate = 90; // 90% success rate for testing

  /**
   * Create a payment session (like Stripe Checkout Session)
   */
  async createPaymentSession(
    bookingId: string,
    amount: number,
    currency: string = "INR",
  ): Promise<PaymentSession> {
    const sessionId = `ps_${crypto.randomBytes(16).toString("hex")}`;

    const session: PaymentSession = {
      sessionId,
      paymentUrl: `http://localhost:3000/api/v1/payments/fake-checkout/${sessionId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      amount,
      currency,
      bookingId,
      status: "pending",
    };

    this.sessions.set(sessionId, session);

    this.logger.log(
      `Created payment session: ${sessionId} for booking: ${bookingId}`,
    );

    return session;
  }

  /**
   * Simulate payment completion (called from fake checkout page)
   * In real implementation, this would be called by Stripe/Razorpay
   */
  async simulatePaymentCompletion(
    sessionId: string,
    forceResult?: "success" | "failed",
  ): Promise<WebhookPayload> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== "pending") {
      throw new Error(`Session already processed: ${session.status}`);
    }

    // Check if session expired
    if (new Date() > session.expiresAt) {
      session.status = "expired";
      this.sessions.set(sessionId, session);

      return {
        eventType: "payment.expired",
        sessionId,
        bookingId: session.bookingId,
        amount: session.amount,
        timestamp: Date.now(),
        gatewayRef: `gw_${crypto.randomBytes(8).toString("hex")}`,
      };
    }

    // Determine success based on success rate or forced result
    const isSuccess = forceResult
      ? forceResult === "success"
      : Math.random() * 100 < this.successRate;

    session.status = isSuccess ? "completed" : "failed";
    this.sessions.set(sessionId, session);

    const payload: WebhookPayload = {
      eventType: isSuccess ? "payment.success" : "payment.failed",
      sessionId,
      bookingId: session.bookingId,
      amount: session.amount,
      timestamp: Date.now(),
      gatewayRef: `gw_${crypto.randomBytes(8).toString("hex")}`,
    };

    this.logger.log(
      `Payment ${isSuccess ? "succeeded" : "failed"} for session: ${sessionId}`,
    );

    return payload;
  }

  /**
   * Generate webhook signature (like Stripe signature)
   */
  generateWebhookSignature(payload: WebhookPayload): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(payload);
    const signedPayload = `${timestamp}.${payloadString}`;

    const signature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(signedPayload)
      .digest("hex");

    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Verify webhook signature (like Stripe signature verification)
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    tolerance: number = 300, // 5 minutes tolerance
  ): boolean {
    try {
      const parts = signature.split(",");
      const timestampPart = parts.find((p) => p.startsWith("t="));
      const signaturePart = parts.find((p) => p.startsWith("v1="));

      if (!timestampPart || !signaturePart) {
        this.logger.warn("Invalid signature format");
        return false;
      }

      const timestamp = parseInt(timestampPart.substring(2), 10);
      const receivedSignature = signaturePart.substring(3);

      // Check timestamp tolerance
      const currentTime = Math.floor(Date.now() / 1000);
      if (Math.abs(currentTime - timestamp) > tolerance) {
        this.logger.warn(
          `Signature timestamp too old: ${currentTime - timestamp}s`,
        );
        return false;
      }

      // Verify signature
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(signedPayload)
        .digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(receivedSignature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        this.logger.warn("Signature mismatch");
      }

      return isValid;
    } catch (error) {
      this.logger.error("Signature verification error", error);
      return false;
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): PaymentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Simulate refund
   */
  async simulateRefund(
    sessionId: string,
    amount?: number,
  ): Promise<{ refundId: string; status: string; amount: number }> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const refundAmount = amount ?? session.amount;

    this.logger.log(
      `Refund processed for session: ${sessionId}, amount: ${refundAmount}`,
    );

    return {
      refundId: `rf_${crypto.randomBytes(8).toString("hex")}`,
      status: "succeeded",
      amount: refundAmount,
    };
  }
}
