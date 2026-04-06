import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessageService {
  constructor(@InjectRepository(Message) private repo: Repository<Message>) {}

  async save(data: any): Promise<any> {
    const msg = this.repo.create({ ...data, type: data.type || 'text' } as any);
    return this.repo.save(msg);
  }

  async saveGroupMsg(data: any): Promise<Message> { return this.save({ ...data, type: data.type || 'text' }); }

  async getHistory(params: { groupId?: string; peerId?: string; currentUserId?: string; limit?: number; before?: string; after?: string }): Promise<Message[]> {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.created_at', 'DESC').limit(params.limit || 50);
    if (params.groupId) qb.andWhere('m.group_id = :gid', { gid: params.groupId });
    // 修复：peerId 查对方，currentUserId 查自己，两者不能相同
    if (params.peerId && params.currentUserId) {
      qb.andWhere('((m.from_id = :pid AND m.to_id = :me) OR (m.from_id = :me AND m.to_id = :pid))',
        { pid: params.peerId, me: params.currentUserId });
    } else if (params.peerId) {
      // 没有 currentUserId 时，用 from_id 过滤（发送方视角的历史）
      qb.andWhere('m.from_id = :pid', { pid: params.peerId });
    }
    if (params.before) qb.andWhere('m.created_at < :before', { before: new Date(params.before) });
    if (params.after) qb.andWhere('m.created_at > :after', { after: new Date(params.after) });
    const result = await qb.getMany();
    return result.reverse();
  }

  async getOfflineMessages(agentId: string, lastReadTime: number, limit = 50) { return this.repo.find({ where: [{ toId: agentId }], order: { createdAt: 'DESC' }, take: limit }); }
  async markRead(messageIds: string[]) { await this.repo.update({ id: In(messageIds) }, { status: 'sent' } as any); }
}
