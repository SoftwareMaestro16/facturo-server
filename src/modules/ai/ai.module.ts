import { Module } from '@nestjs/common';

import { TypedConfigService } from '@/config/typed-config.service';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDER, type AiProvider } from './providers/ai-provider';
import { OpenAiProvider } from './providers/openai-ai.provider';
import { SandboxAiProvider } from './providers/sandbox-ai.provider';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: AI_PROVIDER,
      inject: [TypedConfigService],
      useFactory: (config: TypedConfigService): AiProvider =>
        config.get('AI_PROVIDER') === 'openai' ? new OpenAiProvider(config) : new SandboxAiProvider(),
    },
  ],
})
export class AiModule {}
