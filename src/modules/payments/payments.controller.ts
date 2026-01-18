import { Body, Controller, Post } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { PaymentCallbackDto } from "./dto/payment-callback.dto";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Simulate creating a payment session with an external gateway
  @Post("initiate")
  initiate(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(dto);
  }

  // Simulate a webhook callback from the payment provider
  @Post("callback")
  handleCallback(@Body() dto: PaymentCallbackDto) {
    return this.paymentsService.handleCallback(dto);
  }
}
