import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';
import { ChatGroup } from '../../group/entities/chat-group.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ name: 'from_id' })
  fromId: string;
  @Column({ name: 'to_id', nullable: true })
  toId: string;
  @Column({ name: 'group_id', nullable: true })
  groupId: string;
  @Column({ default: 'text' })
  type: string;
  @Column({ type: 'text', default: '' })
  content: string;
  @Column({ name: 'is_read', default: false })
  isRead: boolean;
  @Column({ name: 'media_url', nullable: true })
  mediaUrl: string;
  @Column({ name: 'file_name', nullable: true })
  fileName: string;
  @Column({ name: 'file_size', nullable: true })
  fileSize: number;
  @Column({ default: 'sent' })
  status: string;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'from_id' }) from: Agent;
  @ManyToOne(() => Agent) @JoinColumn({ name: 'to_id' }) to: Agent;
  @ManyToOne(() => ChatGroup) @JoinColumn({ name: 'group_id' }) group: ChatGroup;
}
