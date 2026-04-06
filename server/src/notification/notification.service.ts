import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationService {
  constructor(@InjectRepository(Notification) private repo: Repository<Notification>) {}
  async create(agentId: string, type: string, title: string, content: string, data?: any) { const n = this.repo.create({ agentId, type, title, content, data }); return this.repo.save(n); }
  async getForAgent(agentId: string, limit = 20, unreadOnly = false) { const where: any = { agentId }; if (unreadOnly) where.isRead = false; return this.repo.find({ where, order: { createdAt: 'DESC' }, take: limit }); }
  async markRead(id: string) { await this.repo.update(id, { isRead: true }); }
}
