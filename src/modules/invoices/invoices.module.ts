import { Module } from '@nestjs/common';

import { EfacturaModule } from '../efactura/efactura.module';

import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

/// Phase 1 adds the draft flow. Phase 2 will wire submission to the e-Factura
/// provider; the module already imports it so the transition costs one line.
@Module({
  imports: [EfacturaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
