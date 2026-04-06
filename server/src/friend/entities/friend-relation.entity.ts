import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';

@Entity('friend_relations')
export class FriendRelation {
  @PrimaryColumn({ name: 'agent_id' }) agentId: string;
  @PrimaryColumn({ name: 'friend_id' }) friendId: string;
  @Column({ default: 'accepted' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'agent_id' }) agent: Agent;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'friend_id' }) friend: Agent;
}
