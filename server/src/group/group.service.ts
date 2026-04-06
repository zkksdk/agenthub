import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatGroup } from './entities/chat-group.entity';
import { GroupMember } from './entities/group-member.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(ChatGroup) private groupRepo: Repository<ChatGroup>,
    @InjectRepository(GroupMember) private memberRepo: Repository<GroupMember>,
  ) {}

  async create(data: { ownerId: string; ownerName?: string; name: string; bio?: string; memberIds?: string[] }) {
    const id = uuidv4();
    const group = this.groupRepo.create({
      id, ownerId: data.ownerId, ownerName: data.ownerName ?? '',
      name: data.name, bio: data.bio || '', type: 'group',
    });
    await this.groupRepo.save(group);
    // 群主自动加入
    await this.memberRepo.save(
      this.memberRepo.create({ groupId: id, agentId: data.ownerId, role: 'owner', joinedAt: new Date() })
    );
    return { id, name: data.name, bio: data.bio, ownerId: data.ownerId, ownerName: data.ownerName };
  }

  async findById(groupId: string) { return this.groupRepo.findOne({ where: { id: groupId } }); }
  async findByOwner(userId: string) { return this.groupRepo.find({ where: { ownerId: userId } }); }

  async findByMember(agentId: string) {
    const memberships = await this.memberRepo.find({ where: { agentId } });
    if (!memberships.length) return [];
    const groupIds = memberships.map(m => m.groupId);
    return this.groupRepo.findByIds(groupIds);
  }

  async getMembers(groupId: string) {
    return this.memberRepo.find({ where: { groupId } });
  }

  async getMemberIds(groupId: string): Promise<string[]> {
    const m = await this.memberRepo.find({ where: { groupId } });
    return m.map(x => x.agentId);
  }

  async addMember(groupId: string, agentId: string) {
    const ex = await this.memberRepo.findOne({ where: { groupId, agentId } });
    if (ex) return true;
    await this.memberRepo.save(
      this.memberRepo.create({ groupId, agentId, role: 'member', joinedAt: new Date() })
    );
    return true;
  }

  async removeMember(groupId: string, agentId: string, actorId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) return false;
    if (group.ownerId !== actorId) return false;
    const m = await this.memberRepo.findOne({ where: { groupId, agentId } });
    if (!m || m.role === 'owner') return false;
    await this.memberRepo.delete({ groupId, agentId });
    return true;
  }

  async isMemberBanned(groupId: string, agentId: string) {
    const m = await this.memberRepo.findOne({ where: { groupId, agentId } });
    if (!m) return false;
    if (m.isBanned && m.bannedUntil && new Date(m.bannedUntil) < new Date()) {
      await this.memberRepo.update({ groupId, agentId }, { isBanned: false });
      return false;
    }
    return m.isBanned;
  }

  async banMember(groupId: string, agentId: string, duration: number, actorId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group || group.ownerId !== actorId) return;
    const bannedUntil = duration ? new Date(Date.now() + duration * 1000) : null;
    await this.memberRepo.update({ groupId, agentId }, { isBanned: true, bannedUntil });
  }

  async unbanMember(groupId: string, agentId: string, actorId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group || group.ownerId !== actorId) return;
    await this.memberRepo.update({ groupId, agentId }, { isBanned: false, bannedUntil: null });
  }

  async dissolve(groupId: string, actorId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group || group.ownerId !== actorId) return;
    await this.memberRepo.delete({ groupId });
    await this.groupRepo.delete({ id: groupId });
  }

  async transferOwner(groupId: string, newOwnerId: string, actorId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group || group.ownerId !== actorId) return;
    await this.memberRepo.update({ groupId, agentId: actorId }, { role: 'member' });
    await this.memberRepo.update({ groupId, agentId: newOwnerId }, { role: 'owner' });
    await this.groupRepo.update({ id: groupId }, { ownerId: newOwnerId });
  }

  async getBannedMembers(groupId: string) {
    return this.memberRepo.find({ where: { groupId, isBanned: true } });
  }
}
