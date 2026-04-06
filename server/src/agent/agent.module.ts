import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentGateway } from './agent.gateway';
import { AgentTokenGuard } from '../common/guards/agent-token.guard';
import { UserJwtGuard } from '../common/guards/user-jwt.guard';
import { MessageModule } from '../message/message.module';
import { GroupModule } from '../group/group.module';
import { FriendModule } from '../friend/friend.module';
import { NotificationModule } from '../notification/notification.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent]),
    forwardRef(() => MessageModule),
    GroupModule,
    forwardRef(() => FriendModule),
    forwardRef(() => NotificationModule),
    WebhookModule,
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentGateway, AgentTokenGuard, UserJwtGuard],
  exports: [AgentService, AgentTokenGuard, UserJwtGuard],
})
export class AgentModule {}
