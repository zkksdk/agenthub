import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';

@Entity('friend_requests')
export class FriendRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'from_id' }) fromId: string;
  @Column({ name: 'to_id' }) toId: string;
  @Column({ type: 'text', nullable: true }) message: string;
  @Column({ default: 'pending' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'from_id' }) from: Agent;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'to_id' }) to: Agent;
}
