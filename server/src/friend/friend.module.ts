import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendRelation } from './entities/friend-relation.entity';
import { FriendRequest } from './entities/friend-request.entity';
import { FriendService } from './friend.service';
import { FriendController } from './friend.controller';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [TypeOrmModule.forFeature([FriendRelation, FriendRequest]), forwardRef(() => AgentModule)],
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
