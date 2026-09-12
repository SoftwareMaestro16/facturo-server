import { Module, type Provider } from '@nestjs/common';

import { TypedConfigService } from '@/config/typed-config.service';

import { EfacturaService } from './efactura.service';
import { EFACTURA_PROVIDER } from './providers/efactura-provider';
import { SandboxEfacturaProvider } from './providers/sandbox-efactura.provider';
import { SfsEfacturaProvider } from './providers/sfs-efactura.provider';

/// The single place that decides which side of the boundary is live. Every
/// other file depends on the interface, never on either implementation.
const providerFactory: Provider = {
  provide: EFACTURA_PROVIDER,
  inject: [TypedConfigService],
  useFactory: (config: TypedConfigService) =>
    config.get('EFACTURA_PROVIDER') === 'sfs'
      ? new SfsEfacturaProvider(config)
      : new SandboxEfacturaProvider(),
};

@Module({
  providers: [providerFactory, EfacturaService],
  exports: [EFACTURA_PROVIDER, EfacturaService],
})
export class EfacturaModule {}
