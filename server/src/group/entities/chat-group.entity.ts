import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { GroupMember } from './group-member.entity';

@Entity('chat_groups')
export class ChatGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 群主 agentId（非 User FK）*/
  @Column({ name: 'owner_id' })
  ownerId: string;

  /** 群主名称（冗余存储）*/
  @Column({ name: 'owner_name', nullable: true })
  ownerName: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: 'group' })
  type: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  @OneToMany(() => GroupMember, gm => gm.group) members: GroupMember[];
}
