import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGroup } from './entities/chat-group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupService } from './group.service';
import { GroupsController } from './group.controller';
import { AgentModule } from '../agent/agent.module';
import { MessageModule } from '../message/message.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatGroup, GroupMember]),
    forwardRef(() => AgentModule),
    MessageModule,
    forwardRef(() => WebhookModule),
  ],
  controllers: [GroupsController],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
