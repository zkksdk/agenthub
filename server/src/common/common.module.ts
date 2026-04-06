import { Module, forwardRef } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [forwardRef(() => AgentModule)],
  exports: [AgentModule],
})
export class CommonModule {}
