import { Injectable } from "@nestjs/common";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { PaymentCallbackDto } from "./dto/payment-callback.dto";

@Injectable()
export class PaymentsService {
  initiate(dto: InitiatePaymentDto) {
    // TODO: integrate with a real payment gateway
    return {
      paymentReference: `pay_${Date.now()}`,
      bookingId: dto.bookingId,
      amount: dto.amount,
      provider: dto.provider ?? "mock-provider",
      redirectUrl: "https://mock-payments.example/checkout",
      status: "INITIATED",
    };
  }

  handleCallback(dto: PaymentCallbackDto) {
    // TODO: verify signature, update booking/payment status transactionally
    return {
      paymentReference: dto.reference,
      status: dto.status,
      message: "Callback received (mock)",
    };
  }
}
