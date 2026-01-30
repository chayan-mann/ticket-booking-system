import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { FakePaymentGateway, WebhookPayload } from './fake-payment-gateway.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentCallbackDto } from './dto/payment-callback.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // Track processed webhook events for idempotency
  private processedEvents: Set<string> = new Set();

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentGateway: FakePaymentGateway,
  ) {}

  /**
   * Initiate payment for a PENDING booking
   * Creates a payment session and returns the checkout URL
   */
  async initiatePayment(dto: InitiatePaymentDto) {
    const { bookingId, userId } = dto;

    // Find the booking and validate
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        seats: {
          include: {
            showSeat: true,
          },
        },
        show: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found: ${bookingId}`);
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only pay for your own bookings');
    }

    if (booking.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot initiate payment for booking with status: ${booking.status}`,
      );
    }

    // Check if booking has expired
    if (booking.expiresAt && new Date() > booking.expiresAt) {
      throw new BadRequestException('Booking has expired. Please create a new booking.');
    }

    // Check if show hasn't started
    if (new Date() > booking.show.startTime) {
      throw new BadRequestException('Cannot pay for a show that has already started');
    }

    // Create payment session with the gateway
    const session = await this.paymentGateway.createPaymentSession(
      bookingId,
      booking.totalAmount,
      'INR',
    );

    // Create payment record in DB
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        bookingId,
        amount: booking.totalAmount,
        status: 'INITIATED',
        reference: session.sessionId,
        gatewayRef: session.sessionId,
      },
    });

    this.logger.log(`Payment initiated for booking: ${bookingId}, session: ${session.sessionId}`);

    return {
      paymentId: payment.id,
      sessionId: session.sessionId,
      paymentUrl: session.paymentUrl,
      expiresAt: session.expiresAt,
      amount: booking.totalAmount,
      currency: 'INR',
      status: 'INITIATED',
    };
  }

  /**
   * Handle webhook callback from payment gateway
   * Verifies signature and updates booking/payment status
   */
  async handleWebhook(
    payload: string,
    signature: string,
  ): Promise<{ success: boolean; message: string }> {
    // Verify webhook signature
    const isValid = this.paymentGateway.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      this.logger.warn('Invalid webhook signature received');
      throw new ForbiddenException('Invalid webhook signature');
    }

    const webhookPayload: WebhookPayload = JSON.parse(payload);
    const { eventType, sessionId, bookingId, gatewayRef } = webhookPayload;

    // Idempotency check - prevent duplicate processing
    const eventKey = `${sessionId}:${eventType}`;
    if (this.processedEvents.has(eventKey)) {
      this.logger.log(`Webhook already processed: ${eventKey}`);
      return { success: true, message: 'Event already processed' };
    }

    this.logger.log(`Processing webhook: ${eventType} for session: ${sessionId}`);

    // Find payment by session reference
    const payment = await this.prisma.payment.findUnique({
      where: { reference: sessionId },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for session: ${sessionId}`);
      throw new NotFoundException('Payment not found');
    }

    // Process based on event type
    switch (eventType) {
      case 'payment.success':
        await this.handlePaymentSuccess(payment.id, bookingId, gatewayRef);
        break;

      case 'payment.failed':
        await this.handlePaymentFailed(payment.id, bookingId);
        break;

      case 'payment.expired':
        await this.handlePaymentExpired(payment.id, bookingId);
        break;

      default:
        this.logger.warn(`Unknown event type: ${eventType}`);
    }

    // Mark event as processed
    this.processedEvents.add(eventKey);

    return { success: true, message: `Processed ${eventType}` };
  }

  /**
   * Handle successful payment - Update booking to CONFIRMED
   */
  private async handlePaymentSuccess(
    paymentId: string,
    bookingId: string,
    gatewayRef: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          gatewayRef,
          gatewayData: JSON.stringify({ confirmedAt: new Date().toISOString() }),
        },
      });

      // Update booking to CONFIRMED
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          expiresAt: null, // No longer expires
        },
      });

      // Delete seat holds for this booking's seats (if any)
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { seats: true },
      });

      if (booking) {
        await tx.seatHold.deleteMany({
          where: {
            showSeatId: { in: booking.seats.map((s) => s.showSeatId) },
          },
        });
      }
    });

    this.logger.log(`Booking confirmed: ${bookingId}`);
  }

  /**
   * Handle failed payment - Update booking to allow retry
   */
  private async handlePaymentFailed(paymentId: string, bookingId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          gatewayData: JSON.stringify({ failedAt: new Date().toISOString() }),
        },
      });

      // Booking stays PENDING for retry (user can try again)
      // But extend the expiry slightly to allow retry
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 more minutes
        },
      });
    });

    this.logger.log(`Payment failed for booking: ${bookingId}, retry allowed`);
  }

  /**
   * Handle expired payment - Update booking to EXPIRED
   */
  private async handlePaymentExpired(paymentId: string, bookingId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          gatewayData: JSON.stringify({ expiredAt: new Date().toISOString() }),
        },
      });

      // Expire the booking
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'EXPIRED' },
      });

      // Delete booking seats to release them
      await tx.bookingSeat.deleteMany({
        where: { bookingId },
      });
    });

    this.logger.log(`Payment expired, booking released: ${bookingId}`);
  }

  /**
   * Simulate completing a fake payment (for testing)
   * This endpoint simulates what a user does on the checkout page
   */
  async simulateFakePayment(
    sessionId: string,
    result: 'success' | 'failed' = 'success',
  ) {
    // Generate webhook payload
    const webhookPayload = await this.paymentGateway.simulatePaymentCompletion(
      sessionId,
      result,
    );

    // Generate signature
    const payloadString = JSON.stringify(webhookPayload);
    const signature = this.paymentGateway.generateWebhookSignature(webhookPayload);

    // Process the webhook
    return this.handleWebhook(payloadString, signature);
  }

  /**
   * Process refund for a confirmed booking
   */
  async processRefund(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: {
          where: { status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        show: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only refund your own bookings');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only confirmed bookings can be refunded');
    }

    const successfulPayment = booking.payments[0];
    if (!successfulPayment) {
      throw new BadRequestException('No successful payment found for this booking');
    }

    // Calculate refund amount based on time until show
    const hoursUntilShow = (booking.show.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    let refundPercentage = 100;

    if (hoursUntilShow < 2) {
      refundPercentage = 0; // No refund within 2 hours
    } else if (hoursUntilShow < 24) {
      refundPercentage = 50; // 50% refund within 24 hours
    }

    const refundAmount = Math.floor((booking.totalAmount * refundPercentage) / 100);

    // Process refund with gateway
    const refundResult = await this.paymentGateway.simulateRefund(
      successfulPayment.reference,
      refundAmount,
    );

    // Update database
    await this.prisma.$transaction(async (tx) => {
      // Update payment
      await tx.payment.update({
        where: { id: successfulPayment.id },
        data: {
          status: 'REFUNDED',
          gatewayData: JSON.stringify({
            refundId: refundResult.refundId,
            refundAmount,
            refundPercentage,
            refundedAt: new Date().toISOString(),
          }),
        },
      });

      // Update booking
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'REFUNDED' },
      });

      // Release seats
      await tx.bookingSeat.deleteMany({
        where: { bookingId },
      });
    });

    this.logger.log(`Refund processed for booking: ${bookingId}, amount: ${refundAmount}`);

    return {
      bookingId,
      originalAmount: booking.totalAmount,
      refundAmount,
      refundPercentage,
      refundId: refundResult.refundId,
      status: 'REFUNDED',
    };
  }

  /**
   * Get payment status for a booking
   */
  async getPaymentStatus(bookingId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, totalAmount: true },
    });

    return {
      bookingId,
      bookingStatus: booking?.status,
      totalAmount: booking?.totalAmount,
      payments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        amount: p.amount,
        reference: p.reference,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  initiate(dto: InitiatePaymentDto) {
    return this.initiatePayment({ ...dto, userId: dto.userId || 'legacy-user' });
  }

  /**
   * Legacy method for backward compatibility
   */
  handleCallback(dto: PaymentCallbackDto) {
    return {
      message: 'Use POST /payments/webhook with proper signature instead',
      status: dto.status,
    };
  }
}
