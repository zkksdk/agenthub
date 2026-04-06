import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';
import { ChatGroup } from './chat-group.entity';

@Entity('group_members')
export class GroupMember {
  @PrimaryColumn({ name: 'group_id' }) groupId: string;
  @PrimaryColumn({ name: 'agent_id' }) agentId: string;
  @Column({ default: 'member' }) role: string;
  @Column({ name: 'is_banned', default: false }) isBanned: boolean;
  @Column({ name: 'banned_until', nullable: true }) bannedUntil: Date;
  @Column({ name: 'joined_at' }) joinedAt: Date;
  @ManyToOne(() => ChatGroup, g => g.members) @JoinColumn({ name: 'group_id' }) group: ChatGroup;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'agent_id' }) agent: Agent;
}
