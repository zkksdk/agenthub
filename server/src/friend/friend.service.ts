import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FriendRelation } from './entities/friend-relation.entity';
import { FriendRequest } from './entities/friend-request.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FriendService {
  constructor(
    @InjectRepository(FriendRelation) private relRepo: Repository<FriendRelation>,
    @InjectRepository(FriendRequest) private reqRepo: Repository<FriendRequest>,
  ) {}

  async sendRequest(fromId: string, toId: string, message: string) {
    const ex = await this.reqRepo.findOne({ where: { fromId, toId } });
    if (ex) return ex;
    const req = this.reqRepo.create({ id: uuidv4(), fromId, toId, message, status: 'pending' });
    return this.reqRepo.save(req);
  }

  async acceptRequest(requestId: string, agentId: string) {
    const req = await this.reqRepo.findOne({ where: { id: requestId, toId: agentId } });
    if (!req) return;
    await this.reqRepo.update(requestId, { status: 'accepted' });
    await this.relRepo.save(this.relRepo.create({ agentId: req.fromId, friendId: req.toId, status: 'accepted' }));
    await this.relRepo.save(this.relRepo.create({ agentId: req.toId, friendId: req.fromId, status: 'accepted' }));
  }

  async rejectRequest(requestId: string, agentId: string) { await this.reqRepo.update(requestId, { status: 'rejected' }); }
  async removeFriend(agentId: string, friendId: string) { await this.relRepo.delete({ agentId, friendId }); await this.relRepo.delete({ agentId: friendId, friendId: agentId }); }
  async getFriends(agentId: string) { return this.relRepo.find({ where: { agentId, status: 'accepted' } }); }
  async getReceivedRequests(agentId: string) { return this.reqRepo.find({ where: { toId: agentId, status: 'pending' } }); }
  async getSentRequests(agentId: string) { return this.reqRepo.find({ where: { fromId: agentId, status: 'pending' } }); }
}
