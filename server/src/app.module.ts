import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user/entities/user.entity';
import { Agent } from './agent/entities/agent.entity';
import { Message } from './message/entities/message.entity';
import { ChatGroup } from './group/entities/chat-group.entity';
import { GroupMember } from './group/entities/group-member.entity';
import { FriendRelation } from './friend/entities/friend-relation.entity';
import { FriendRequest } from './friend/entities/friend-request.entity';
import { Notification } from './notification/entities/notification.entity';
import { WebhookRegistration } from './webhook/entities/webhook.entity';
import { AuthModule } from './auth/auth.module';
import { AgentModule } from './agent/agent.module';
import { MessageModule } from './message/message.module';
import { GroupModule } from './group/group.module';
import { FriendModule } from './friend/friend.module';
import { NotificationModule } from './notification/notification.module';
import { AdminModule } from './admin/admin.module';
import { MediaModule } from './media/media.module';
import { WebhookModule } from './webhook/webhook.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: './data/agenthub.db',
      entities: [
        User, Agent, Message, ChatGroup, GroupMember,
        FriendRelation, FriendRequest, Notification,
        WebhookRegistration,
      ],
      synchronize: true,
      logging: false,
    }),
    AuthModule,
    MessageModule,
    AgentModule,
    GroupModule,
    FriendModule,
    NotificationModule,
    AdminModule,
    MediaModule,
    WebhookModule,
    CommonModule,
  ],
})
export class AppModule {}
