import { Module, type Provider } from '@nestjs/common';

import { TypedConfigService } from '@/config/typed-config.service';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MaibPaymentProvider } from './providers/maib-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider';
import { SandboxPaymentProvider } from './providers/sandbox-payment.provider';

const providerFactory: Provider = {
  provide: PAYMENT_PROVIDER,
  inject: [TypedConfigService],
  useFactory: (config: TypedConfigService) =>
    config.get('MAIB_PROVIDER') === 'maib' ? new MaibPaymentProvider(config) : new SandboxPaymentProvider(),
};

@Module({
  controllers: [BillingController],
  providers: [providerFactory, BillingService],
  exports: [PAYMENT_PROVIDER, BillingService],
})
export class BillingModule {}
