import { Module, Provider } from '@nestjs/common';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { GeminiService } from './gemini.service';
import { SttService } from './stt.service';
import { SoapService } from './soap.service';
import { OpenAiSttProvider } from './providers/openai-stt.provider';
import { ClaudeLlmProvider } from './providers/claude-llm.provider';
import { GeminiSttProvider, GeminiLlmProvider } from './providers/gemini.providers';
import { MockSttProvider } from './providers/mock-stt.provider';
import { MockLlmProvider } from './providers/mock-llm.provider';
import {
  resolverProveedoresLlm,
  resolverProveedoresStt,
} from './providers/resolve-ia-providers';
import {
  STT_PROVIDERS,
  LLM_PROVIDERS,
  SttProvider,
  LlmProvider,
} from './providers/provider.interface';
import { validateEnv } from '../../common/config/env.schema';
import { StorageModule } from '../storage/storage.module';
import { ConsultasRepository } from '../consultas/consultas.repository';
import { IA_QUEUE } from './queue/queue.interface';
import { InMemoryQueueService } from './queue/in-memory-queue.service';
import { CloudTasksQueueService } from './queue/cloud-tasks-queue.service';
import { loadQueueConfig } from '../../common/config/env';

// Driver de cola por env (default inmemory para dev/test).
const queueProvider: Provider = {
  provide: IA_QUEUE,
  useClass:
    loadQueueConfig().driver === 'cloudtasks' ? CloudTasksQueueService : InMemoryQueueService,
};

// Orden de proveedores STT segun env (mock solo dev/test; primario + fallback real).
const sttProviders: Provider = {
  provide: STT_PROVIDERS,
  inject: [MockSttProvider, OpenAiSttProvider, GeminiSttProvider],
  useFactory: (
    mock: MockSttProvider,
    openai: OpenAiSttProvider,
    gemini: GeminiSttProvider,
  ): SttProvider[] => resolverProveedoresStt(validateEnv(), mock, openai, gemini),
};

// Orden de proveedores LLM segun env (mock solo dev/test; primario + fallback real).
const llmProviders: Provider = {
  provide: LLM_PROVIDERS,
  inject: [MockLlmProvider, ClaudeLlmProvider, GeminiLlmProvider],
  useFactory: (
    mock: MockLlmProvider,
    claude: ClaudeLlmProvider,
    gemini: GeminiLlmProvider,
  ): LlmProvider[] => resolverProveedoresLlm(validateEnv(), mock, claude, gemini),
};

@Module({
  imports: [StorageModule],
  controllers: [IaController],
  providers: [
    IaService,
    GeminiService,
    SttService,
    SoapService,
    MockSttProvider,
    MockLlmProvider,
    OpenAiSttProvider,
    ClaudeLlmProvider,
    GeminiSttProvider,
    GeminiLlmProvider,
    sttProviders,
    llmProviders,
    ConsultasRepository,
    queueProvider,
  ],
  exports: [IaService, SttService, SoapService],
})
export class IaModule {}
