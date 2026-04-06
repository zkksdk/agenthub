import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Agent } from '../agent/entities/agent.entity';
import { ChatGroup } from '../group/entities/chat-group.entity';
import { GroupMember } from '../group/entities/group-member.entity';
import { Message } from '../message/entities/message.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Agent, ChatGroup, GroupMember, Message])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
