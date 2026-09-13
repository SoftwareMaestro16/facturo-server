import { Module } from '@nestjs/common';

import { EfacturaModule } from '../efactura/efactura.module';

import { IncomingInvoicesController } from './incoming-invoices.controller';
import { InvoiceExchangeController } from './invoice-exchange.controller';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [EfacturaModule],
  controllers: [InvoicesController, InvoiceExchangeController, IncomingInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
