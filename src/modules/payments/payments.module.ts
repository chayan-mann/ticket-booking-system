import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { FakePaymentGateway } from "./fake-payment-gateway.service";

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, FakePaymentGateway],
  exports: [PaymentsService, FakePaymentGateway],
})
export class PaymentsModule {}
