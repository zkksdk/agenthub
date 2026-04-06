import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';

@Entity('users')
export class User {
  @PrimaryColumn()
  id: string;
  @Column({ unique: true })
  username: string;
  @Column({ name: 'password_hash' })
  passwordHash: string;
  @Column({ default: 'owner' })
  role: string;
  @Column({ default: 100 })
  quota: number;
  @Column({ default: 'active' })
  status: string;
  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  @OneToMany(() => Agent, agent => agent.user)
  agents: Agent[];
}
