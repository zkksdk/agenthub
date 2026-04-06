#!/bin/bash
BASE=/workspace/agenthub/server/src

# Fix agent.service.ts - explicit returns
cat > $BASE/agent/agent.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AgentService {
  constructor(@InjectRepository(Agent) private repo: Repository<Agent>) {}

  async register(userId: string, name: string, bio: string): Promise<{ id: string; name: string; bio: string; token: string }> {
    const id = uuidv4();
    const token = uuidv4();
    const saved = await this.repo.save(this.repo.create({ id, userId, name, bio, token } as any) as any);
    return { id: saved.id, name: saved.name, bio: saved.bio, token: saved.token };
  }

  async findByToken(token: string) { return this.repo.findOne({ where: { token }, relations: ['user'] }); }
  async findById(id: string) { return this.repo.findOne({ where: { id } }); }
  async findByUserId(userId: string) { return this.repo.find({ where: { userId } }); }
  async findAll() { return this.repo.find({ relations: ['user'] }); }
  async findOnline() { return this.repo.find({ where: { status: 'online' } }); }
  async search(keyword: string) { return this.repo.createQueryBuilder('a').where('a.name ILIKE :kw OR a.bio ILIKE :kw', { kw: '%' + keyword + '%' }).limit(20).getMany(); }
  async updateStatus(id: string, status: 'online' | 'offline') { await this.repo.update(id, { status, lastActiveAt: new Date() } as any); }
  async updateLastReadTime(id: string, time: number) { await this.repo.update(id, { lastReadTime: time } as any); }
  async updateInfo(id: string, name: string, bio: string, avatar: string) { await this.repo.update(id, { name, bio, avatar } as any); return this.findById(id); }
  async delete(id: string) { await this.repo.delete(id); }
  async update(id: string, data: Partial<Agent>) { await this.repo.update(id, data as any); return this.findById(id); }
}
EOF

# Fix auth.service.ts - use Agent type explicitly
cat > $BASE/auth/auth.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';
import { Agent } from '../agent/entities/agent.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    private jwtService: JwtService,
  ) {}

  async login(userId: string, password: string) {
    const user = await this.userRepo.findOne({ where: { username: userId } });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    user.lastLoginAt = new Date();
    await this.userRepo.save(user as any);
    const token = this.jwtService.sign({ sub: user.id, username: user.username, role: user.role });
    return { token, userId: user.id, username: user.username, role: user.role };
  }

  async registerAgent(userId: string, name: string, bio: string) {
    const agentId = uuidv4();
    const token = uuidv4();
    const data = { id: agentId, userId, name, bio, token } as any;
    const saved = await this.agentRepo.save(this.agentRepo.create(data)) as Agent;
    return { id: saved.id, name: saved.name, bio: saved.bio || '', token: saved.token };
  }

  async validateAgent(token: string) { return this.agentRepo.findOne({ where: { token }, relations: ['user'] }); }
  async createUser(username: string, password: string, role = 'owner') {
    const hash = await bcrypt.hash(password, 10);
    const data = { id: uuidv4(), username, passwordHash: hash, role } as any;
    return this.userRepo.save(this.userRepo.create(data));
  }
}
EOF

# Fix message.service.ts - use explicit returns
cat > $BASE/message/message.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessageService {
  constructor(@InjectRepository(Message) private repo: Repository<Message>) {}

  async save(data: any): Promise<Message> {
    const msg = this.repo.create({ ...data, type: data.type || 'text' } as any);
    return this.repo.save(msg) as Promise<Message>;
  }

  async saveGroupMsg(data: any): Promise<Message> { return this.save({ ...data, type: data.type || 'text' }); }

  async getHistory(params: any): Promise<Message[]> {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.created_at', 'DESC').limit(params.limit || 50);
    if (params.groupId) qb.andWhere('m.group_id = :gid', { gid: params.groupId });
    if (params.peerId) qb.andWhere('((m.from_id = :pid AND m.to_id = :me) OR (m.from_id = :me AND m.to_id = :pid))', { pid: params.peerId, me: params.peerId });
    if (params.before) qb.andWhere('m.created_at < :before', { before: new Date(params.before) });
    if (params.after) qb.andWhere('m.created_at > :after', { after: new Date(params.after) });
    const result = await qb.getMany();
    return result.reverse();
  }

  async getOfflineMessages(agentId: string, lastReadTime: number, limit = 50) { return this.repo.find({ where: [{ toId: agentId }], order: { createdAt: 'DESC' }, take: limit }); }
  async markRead(messageIds: string[]) { await this.repo.update({ id: In(messageIds) }, { status: 'sent' } as any); }
}
EOF

# Fix group.service.ts - add agentRepo via TypeOrmModule properly
cat > $BASE/group/group.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGroup } from './entities/chat-group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupService } from './group.service';
import { Agent } from '../agent/entities/agent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatGroup, GroupMember, Agent])],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
EOF

# Fix admin.service.ts
cat > $BASE/admin/admin.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Agent } from '../agent/entities/agent.entity';
import { ChatGroup } from '../group/entities/chat-group.entity';
import { Message } from '../message/entities/message.entity';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(ChatGroup) private groupRepo: Repository<ChatGroup>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
  ) {}

  async getOwners() {
    const users = await this.userRepo.find({ where: { role: 'owner' as any } });
    const result = [];
    for (const u of users) {
      const agents = await this.agentRepo.find({ where: { userId: u.id } });
      const groups = await this.groupRepo.find({ where: { ownerId: u.id } });
      result.push({ userId: u.id, username: u.username, status: u.status, agentCount: agents.length, groupCount: groups.length, agents, groups });
    }
    return result;
  }

  async getStats() {
    return {
      totalUsers: await this.userRepo.count({ where: { role: 'owner' as any } }),
      totalAgents: await this.agentRepo.count(),
      onlineAgents: await this.agentRepo.count({ where: { status: 'online' as any } }),
      totalGroups: await this.groupRepo.count(),
      totalMessages: await this.msgRepo.count(),
    };
  }

  async createUser(username: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ id: uuidv4(), username, passwordHash: hash, role: 'owner' } as any);
    return this.userRepo.save(user);
  }

  async deleteUser(userId: string) { await this.agentRepo.delete({ userId } as any); await this.userRepo.delete({ id: userId }); }
  async deleteAgent(agentId: string) { await this.agentRepo.delete({ id: agentId } as any); }
  async searchMessages(keyword: string, limit = 50) { return this.msgRepo.createQueryBuilder('m').where('m.content ILIKE :kw', { kw: '%' + keyword + '%' }).orderBy('m.created_at', 'DESC').limit(limit).getMany(); }
}
EOF

echo "Type fixes applied"
