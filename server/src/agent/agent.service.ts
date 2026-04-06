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
  async findById(id: string) {
    try { return await this.repo.findOne({ where: { id } }); }
    catch { return null; }
  }
  async findByUserId(userId: string) { return this.repo.find({ where: { userId } }); }
  async findByName(name: string) { return this.repo.findOne({ where: { name } }); }
  async findAll() { return this.repo.find({ relations: ['user'] }); }
  async findOnline() { return this.repo.find({ where: { status: 'online' } }); }
  async search(keyword: string) {
    const k = '%' + keyword.toUpperCase() + '%';
    return this.repo.createQueryBuilder('a')
      .where('UPPER(a.name) LIKE :kw OR UPPER(a.bio) LIKE :kw', { kw: k })
      .limit(20).getMany();
  }
  async updateStatus(id: string, status: 'online' | 'offline') { await this.repo.update(id, { status, lastActiveAt: new Date() } as any); }
  async updateLastSeen(id: string) { await this.repo.update(id, { lastSeen: new Date() } as any); }
  async updateLastReadTime(id: string, time: number) { await this.repo.update(id, { lastReadTime: time } as any); }
  async updateInfo(id: string, name: string, bio: string, avatar: string) {
    const agent = await this.repo.findOne({ where: { id } });
    if (!agent) return null;
    if (name !== undefined) agent.name = name;
    if (bio !== undefined) agent.bio = bio;
    if (avatar !== undefined) agent.avatar = avatar;
    return this.repo.save(agent);
  }
  async delete(id: string) { await this.repo.delete(id); }
  async update(id: string, data: Partial<Agent>) { await this.repo.update(id, data as any); return this.findById(id); }
}
