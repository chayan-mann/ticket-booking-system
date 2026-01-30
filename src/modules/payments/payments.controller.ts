import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Initiate payment for a PENDING booking
   * Returns a payment URL for the user to complete payment
   */
  @Post('initiate')
  @ApiOperation({ summary: 'Initiate payment for a booking' })
  initiatePayment(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiatePayment(dto);
  }

  /**
   * Webhook endpoint for payment gateway callbacks
   * Requires signature verification header
   */
  @Post('webhook')
  @ApiOperation({ summary: 'Payment gateway webhook callback' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-payment-signature') signature: string,
  ) {
    const payload = req.body ? JSON.stringify(req.body) : '';
    return this.paymentsService.handleWebhook(payload, signature);
  }

  /**
   * Simulate a fake payment completion (for testing)
   * In production, this would be triggered by the actual payment gateway
   */
  @Post('simulate/:sessionId')
  @ApiOperation({ summary: 'Simulate payment completion (testing only)' })
  simulatePayment(
    @Param('sessionId') sessionId: string,
    @Body() body: { result?: 'success' | 'failed' },
  ) {
    return this.paymentsService.simulateFakePayment(
      sessionId,
      body.result || 'success',
    );
  }

  /**
   * Process refund for a booking
   */
  @Post('refund/:bookingId')
  @ApiOperation({ summary: 'Process refund for a confirmed booking' })
  processRefund(
    @Param('bookingId') bookingId: string,
    @Body() body: { userId: string },
  ) {
    return this.paymentsService.processRefund(bookingId, body.userId);
  }

  /**
   * Get payment status for a booking
   */
  @Get('status/:bookingId')
  @ApiOperation({ summary: 'Get payment status for a booking' })
  getPaymentStatus(@Param('bookingId') bookingId: string) {
    return this.paymentsService.getPaymentStatus(bookingId);
  }

  /**
   * Fake checkout page endpoint (simulates external gateway page)
   * In real implementation, user would be redirected to Stripe/Razorpay
   */
  @Get('fake-checkout/:sessionId')
  @ApiOperation({ summary: 'Fake checkout page (testing only)' })
  getFakeCheckoutPage(@Param('sessionId') sessionId: string) {
    return {
      message: 'Fake Payment Gateway Checkout',
      sessionId,
      instructions: [
        'This simulates a payment gateway checkout page.',
        'To complete payment, call POST /payments/simulate/:sessionId with { "result": "success" }',
        'To simulate failed payment, use { "result": "failed" }',
      ],
      completeUrl: `/api/v1/payments/simulate/${sessionId}`,
    };
  }
}
