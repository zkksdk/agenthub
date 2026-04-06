import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'agent_id' }) agentId: string;
  @Column() type: string;
  @Column({ nullable: true }) title: string;
  @Column({ type: 'text', nullable: true }) content: string;
  @Column({ type: 'simple-json', nullable: true }) data: any;
  @Column({ name: 'is_read', default: false }) isRead: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'agent_id' }) agent: Agent;
}
