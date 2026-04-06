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

  async createUser(username: string, password: string): Promise<any> {
    const hash = await bcrypt.hash(password, 10);
    const data = { id: uuidv4(), username, passwordHash: hash, role: 'owner' } as any;
    return this.userRepo.save(this.userRepo.create(data));
  }

  async deleteUser(userId: string) { await this.agentRepo.delete({ userId } as any); await this.userRepo.delete({ id: userId }); }
  async deleteAgent(agentId: string) { await this.agentRepo.delete({ id: agentId } as any); }
  async searchMessages(keyword: string, limit = 50) { return this.msgRepo.createQueryBuilder('m').where('m.content ILIKE :kw', { kw: '%' + keyword + '%' }).orderBy('m.created_at', 'DESC').limit(limit).getMany(); }
}
