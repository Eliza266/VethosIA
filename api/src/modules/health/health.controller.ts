import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';

interface HealthResponse {
  status: 'ok';
  time: string;
}

// GET /v1/health -> { status: 'ok', time }. Publico: lo usa Cloud Run / uptime checks.
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health(): HealthResponse {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
