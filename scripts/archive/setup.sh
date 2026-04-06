#!/bin/bash
# Write all entity files at once
BASE=/workspace/agenthub/server/src

# Agent entity
cat > $BASE/agent/entities/agent.entity.ts << 'EOF'
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('agents')
export class Agent {
  @PrimaryColumn() id: string;
  @Column({ name: 'user_id' }) userId: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) bio: string;
  @Column({ nullable: true }) avatar: string;
  @Column({ unique: true }) token: string;
  @Column({ type: 'enum', enum: ['online', 'offline', 'banned'], default: 'offline' }) status: 'online' | 'offline' | 'banned';
  @Column({ name: 'last_active_at', nullable: true }) lastActiveAt: Date;
  @Column({ name: 'last_read_time', type: 'bigint', default: 0 }) lastReadTime: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @ManyToOne(() => User, user => user.agents) @JoinColumn({ name: 'user_id' }) user: User;
}
EOF

# Message entity
cat > $BASE/message/entities/message.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';
import { ChatGroup } from '../../group/entities/chat-group.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'from_id' }) fromId: string;
  @Column({ name: 'to_id', nullable: true }) toId: string;
  @Column({ name: 'group_id', nullable: true }) groupId: string;
  @Column({ type: 'enum', enum: ['text', 'image', 'file', 'voice'], default: 'text' }) type: 'text' | 'image' | 'file' | 'voice';
  @Column({ type: 'text', default: '' }) content: string;
  @Column({ name: 'media_url', nullable: true }) mediaUrl: string;
  @Column({ name: 'file_name', nullable: true }) fileName: string;
  @Column({ name: 'file_size', nullable: true }) fileSize: number;
  @Column({ type: 'enum', enum: ['sending', 'sent', 'error'], default: 'sent' }) status: 'sending' | 'sent' | 'error';
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'from_id' }) from: Agent;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'to_id' }) to: Agent;
  @ManyToOne(() => ChatGroup) @JoinColumn({ name: 'group_id' }) group: ChatGroup;
}
EOF

# ChatGroup entity
cat > $BASE/group/entities/chat-group.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { GroupMember } from './group-member.entity';

@Entity('chat_groups')
export class ChatGroup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'owner_id' }) ownerId: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) bio: string;
  @Column({ nullable: true }) avatar: string;
  @Column({ type: 'enum', enum: ['group', 'direct'], default: 'group' }) type: 'group' | 'direct';
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @ManyToOne(() => User, user => user.groups) @JoinColumn({ name: 'owner_id' }) owner: User;
  @OneToMany(() => GroupMember, gm => gm.group) members: GroupMember[];
}
EOF

# GroupMember entity
cat > $BASE/group/entities/group-member.entity.ts << 'EOF'
import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';
import { ChatGroup } from './chat-group.entity';

@Entity('group_members')
export class GroupMember {
  @PrimaryColumn({ name: 'group_id' }) groupId: string;
  @PrimaryColumn({ name: 'agent_id' }) agentId: string;
  @Column({ type: 'enum', enum: ['owner', 'admin', 'member'], default: 'member' }) role: 'owner' | 'admin' | 'member';
  @Column({ name: 'is_banned', default: false }) isBanned: boolean;
  @Column({ name: 'banned_until', nullable: true }) bannedUntil: Date;
  @Column({ name: 'joined_at' }) joinedAt: Date;
  @ManyToOne(() => ChatGroup, g => g.members) @JoinColumn({ name: 'group_id' }) group: ChatGroup;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'agent_id' }) agent: Agent;
}
EOF

# FriendRelation entity
cat > $BASE/friend/entities/friend-relation.entity.ts << 'EOF'
import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';

@Entity('friend_relations')
export class FriendRelation {
  @PrimaryColumn({ name: 'agent_id' }) agentId: string;
  @PrimaryColumn({ name: 'friend_id' }) friendId: string;
  @Column({ type: 'enum', enum: ['pending', 'accepted', 'blocked'], default: 'accepted' }) status: 'pending' | 'accepted' | 'blocked';
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'agent_id' }) agent: Agent;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'friend_id' }) friend: Agent;
}
EOF

# FriendRequest entity
cat > $BASE/friend/entities/friend-request.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';

@Entity('friend_requests')
export class FriendRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'from_id' }) fromId: string;
  @Column({ name: 'to_id' }) toId: string;
  @Column({ type: 'text', nullable: true }) message: string;
  @Column({ type: 'enum', enum: ['pending', 'accepted', 'rejected'], default: 'pending' }) status: 'pending' | 'accepted' | 'rejected';
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'from_id' }) from: Agent;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'to_id' }) to: Agent;
}
EOF

# Notification entity
cat > $BASE/notification/entities/notification.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'agent_id' }) agentId: string;
  @Column() type: string;
  @Column({ nullable: true }) title: string;
  @Column({ type: 'text', nullable: true }) content: string;
  @Column({ type: 'jsonb', nullable: true }) data: any;
  @Column({ name: 'is_read', default: false }) isRead: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'agent_id' }) agent: Agent;
}
EOF

echo "All entities written successfully"
