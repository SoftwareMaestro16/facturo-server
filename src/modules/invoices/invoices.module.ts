import { Module } from '@nestjs/common';

import { EfacturaModule } from '../efactura/efactura.module';

/// Phase 1 adds the controller and service; phase 2 wires the submission queue
/// to the e-Factura provider. The arithmetic and the status machine already
/// live in model/ and are covered by unit tests.
@Module({
  imports: [EfacturaModule],
})
export class InvoicesModule {}
