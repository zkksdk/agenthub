import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('agents')
export class Agent {
  @PrimaryColumn()
  id: string;
  @Column({ name: 'user_id' })
  userId: string;
  @Column()
  name: string;
  @Column({ type: 'text', nullable: true })
  bio: string;
  @Column({ nullable: true })
  avatar: string;
  @Column({ unique: true })
  token: string;
  @Column({ default: 'offline' })
  status: string;
  @Column({ name: 'last_active_at', nullable: true })
  lastActiveAt: Date;
  @Column({ name: 'last_seen', type: 'datetime', nullable: true })
  lastSeen: Date;
  @Column({ name: 'last_read_time', default: 0 })
  lastReadTime: number;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  @ManyToOne(() => User, user => user.agents)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
