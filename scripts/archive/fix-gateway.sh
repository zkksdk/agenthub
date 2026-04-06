#!/bin/bash
BASE=/workspace/agenthub/server/src

# Agent Gateway
cat > $BASE/agent/agent.gateway.ts << 'GATEWAYEOF'
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AgentService } from './agent.service';
import { MessageService } from '../message/message.service';
import { GroupService } from '../group/group.service';
import { FriendService } from '../friend/friend.service';
import { NotificationService } from '../notification/notification.service';

@WebSocketGateway({ cors: { origin: '*' }, path: '/ws' })
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private agentSockets = new Map<string, string>();
  private socketAgents = new Map<string, string>();

  constructor(
    private agentService: AgentService,
    private messageService: MessageService,
    private groupService: GroupService,
    private friendService: FriendService,
    private notifService: NotificationService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) { socket.disconnect(); return; }
      const agent: any = await this.agentService.findByToken(token);
      if (!agent) { socket.disconnect(); return; }
      this.agentSockets.set(agent.id, socket.id);
      this.socketAgents.set(socket.id, agent.id);
      await this.agentService.updateStatus(agent.id, 'online');
      socket.data.agent = agent;
      this.server.emit('push.friend_status', { agentId: agent.id, agentName: agent.name, status: 'online', timestamp: Date.now() });
      socket.emit('auth_success', { agentId: agent.id });
    } catch { socket.disconnect(); }
  }

  async handleDisconnect(socket: Socket) {
    const agentId = this.socketAgents.get(socket.id);
    if (agentId) {
      await this.agentService.updateStatus(agentId, 'offline');
      this.server.emit('push.friend_status', { agentId, status: 'offline', timestamp: Date.now() });
      this.agentSockets.delete(agentId);
      this.socketAgents.delete(socket.id);
    }
  }

  private getSocketId(agentId: string) { return this.agentSockets.get(agentId); }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket) { socket.emit('pong'); }

  @SubscribeMessage('chat')
  async handleChat(@ConnectedSocket() socket: Socket, @MessageBody() data: { to: string; content: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const target = await this.agentService.findById(data.to);
    const msg = await this.messageService.save({ fromId: agent.id, toId: data.to, content: data.content, type: 'text' });
    const pushData = { messageId: msg.id, from: { agentId: agent.id, agentName: agent.name }, to: { agentId: target?.id, agentName: target?.name }, content: data.content, timestamp: Date.now() };
    socket.emit('push.ack', { messageId: msg.id, timestamp: msg.createdAt.getTime() });
    const sid = this.getSocketId(data.to);
    if (sid) this.server.to(sid).emit('push.chat', pushData);
    return { ok: true, data: { messageId: msg.id, timestamp: msg.createdAt.getTime() } };
  }

  @SubscribeMessage('group_chat')
  async handleGroupChat(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; content: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const banned = await this.groupService.isMemberBanned(data.groupId, agent.id);
    if (banned) return { ok: false, error: 'Banned' };
    const group = await this.groupService.findById(data.groupId);
    const msg = await this.messageService.saveGroupMsg({ fromId: agent.id, groupId: data.groupId, content: data.content, type: 'text' });
    const pushData = { messageId: msg.id, from: { agentId: agent.id, agentName: agent.name }, groupId: data.groupId, groupName: group?.name, content: data.content, timestamp: Date.now() };
    const members = await this.groupService.getMemberIds(data.groupId);
    for (const mid of members) { const sid = this.getSocketId(mid); if (sid) this.server.to(sid).emit('push.group_chat', pushData); }
    return { ok: true, data: { messageId: msg.id, timestamp: msg.createdAt.getTime() } };
  }

  @SubscribeMessage('group.create')
  async handleCreateGroup(@ConnectedSocket() socket: Socket, @MessageBody() data: { name: string; bio?: string; memberIds?: string[] }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const group = await this.groupService.create({ ownerId: agent.userId, name: data.name, bio: data.bio, memberIds: data.memberIds });
    return { ok: true, data: group };
  }

  @SubscribeMessage('group.invite')
  async handleInvite(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; targetId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    await this.groupService.addMember(data.groupId, data.targetId, agent);
    const group = await this.groupService.findById(data.groupId);
    const sid = this.getSocketId(data.targetId);
    if (sid) this.server.to(sid).emit('push.group_invite', { groupId: data.groupId, groupName: group?.name, from: { agentId: agent.id, agentName: agent.name }, timestamp: Date.now() });
    return { ok: true };
  }

  @SubscribeMessage('group.remove')
  async handleRemove(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; targetId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const r = await this.groupService.removeMember(data.groupId, data.targetId, agent);
    return { ok: r };
  }

  @SubscribeMessage('group.ban')
  async handleBan(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; targetId: string; duration?: number }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    await this.groupService.banMember(data.groupId, data.targetId, data.duration || 0, agent);
    return { ok: true };
  }

  @SubscribeMessage('group.unban')
  async handleUnban(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; targetId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    await this.groupService.unbanMember(data.groupId, data.targetId, agent);
    return { ok: true };
  }

  @SubscribeMessage('group.dissolve')
  async handleDissolve(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    await this.groupService.dissolve(data.groupId, agent);
    return { ok: true };
  }

  @SubscribeMessage('group.transfer')
  async handleTransfer(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; newOwnerId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    await this.groupService.transferOwner(data.groupId, data.newOwnerId, agent);
    return { ok: true };
  }

  @SubscribeMessage('group.list')
  async handleGroupList(@ConnectedSocket() socket: Socket) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    const groups = await this.groupService.findByOwner(agent.userId);
    return { ok: true, data: { groups } };
  }

  @SubscribeMessage('group.info')
  async handleGroupInfo(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string }) {
    const group = await this.groupService.findById(data.groupId);
    const members = await this.groupService.getMembers(data.groupId);
    return { ok: true, data: { group, members } };
  }

  @SubscribeMessage('group.member_list')
  async handleMemberList(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string }) {
    const members = await this.groupService.getMembers(data.groupId);
    return { ok: true, data: { members } };
  }

  @SubscribeMessage('group.banned_list')
  async handleBannedList(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string }) {
    const banned = await this.groupService.getBannedMembers(data.groupId);
    return { ok: true, data: { banned } };
  }

  @SubscribeMessage('friend.request')
  async handleFriendRequest(@ConnectedSocket() socket: Socket, @MessageBody() data: { toId: string; message?: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    const result = await this.friendService.sendRequest(agent.id, data.toId, data.message || '');
    const sid = this.getSocketId(data.toId);
    if (sid) this.server.to(sid).emit('push.friend_request', { requestId: result.id, from: { agentId: agent.id, agentName: agent.name }, message: data.message, timestamp: Date.now() });
    return { ok: true, data: { requestId: result.id } };
  }

  @SubscribeMessage('friend.accept')
  async handleFriendAccept(@ConnectedSocket() socket: Socket, @MessageBody() data: { requestId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    await this.friendService.acceptRequest(data.requestId, agent.id);
    return { ok: true };
  }

  @SubscribeMessage('friend.reject')
  async handleFriendReject(@ConnectedSocket() socket: Socket, @MessageBody() data: { requestId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    await this.friendService.rejectRequest(data.requestId, agent.id);
    return { ok: true };
  }

  @SubscribeMessage('friend.remove')
  async handleFriendRemove(@ConnectedSocket() socket: Socket, @MessageBody() data: { friendId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    await this.friendService.removeFriend(agent.id, data.friendId);
    return { ok: true };
  }

  @SubscribeMessage('friend.list')
  async handleFriendList(@ConnectedSocket() socket: Socket) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    const friends = await this.friendService.getFriends(agent.id);
    return { ok: true, data: { friends } };
  }

  @SubscribeMessage('friend.requests_received')
  async handleReceivedRequests(@ConnectedSocket() socket: Socket) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    const requests = await this.friendService.getReceivedRequests(agent.id);
    return { ok: true, data: { requests } };
  }

  @SubscribeMessage('message.history')
  async handleHistory(@ConnectedSocket() socket: Socket, @MessageBody() data: { peerId?: string; groupId?: string; limit?: number; before?: number }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    const messages = await this.messageService.getHistory({ ...data, limit: data.limit || 50 });
    return { ok: true, data: { messages } };
  }

  @SubscribeMessage('message.read')
  async handleRead(@ConnectedSocket() socket: Socket, @MessageBody() data: { messageIds: string[] }) {
    const agent: any = socket.data.agent;
    if (!agent) return;
    await this.messageService.markRead(data.messageIds);
    await this.agentService.updateLastReadTime(agent.id, Date.now());
  }

  @SubscribeMessage('agent.my_info')
  async handleMyInfo(@ConnectedSocket() socket: Socket) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    return { ok: true, data: { agent: { id: agent.id, name: agent.name, bio: agent.bio, avatar: agent.avatar, status: agent.status } } };
  }

  @SubscribeMessage('agent.update')
  async handleUpdate(@ConnectedSocket() socket: Socket, @MessageBody() data: { name?: string; bio?: string; avatar?: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    const updated = await this.agentService.updateInfo(agent.id, data.name || agent.name, data.bio ?? agent.bio, data.avatar || agent.avatar || '');
    return { ok: true, data: { agent: updated } };
  }

  @SubscribeMessage('notification.list')
  async handleNotifList(@ConnectedSocket() socket: Socket, @MessageBody() data: { limit?: number; unreadOnly?: boolean }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    const notifications = await this.notifService.getForAgent(agent.id, data.limit || 20, data.unreadOnly);
    return { ok: true, data: { notifications } };
  }

  @SubscribeMessage('notification.read')
  async handleNotifRead(@ConnectedSocket() socket: Socket, @MessageBody() data: { notificationId: string }) {
    await this.notifService.markRead(data.notificationId);
    return { ok: true };
  }
}
GATEWAYEOF

# Fix auth.service.ts - change create to use plain object then save
cat > $BASE/auth/auth.service.ts << 'AUTHEOF'
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
    await this.userRepo.save(user);
    const token = this.jwtService.sign({ sub: user.id, username: user.username, role: user.role });
    return { token, userId: user.id, username: user.username, role: user.role };
  }

  async registerAgent(userId: string, name: string, bio: string) {
    const agentId = uuidv4();
    const token = uuidv4();
    const agent = this.agentRepo.create({ id: agentId, userId, name, bio, token } as any);
    const saved = await this.agentRepo.save(agent);
    return { id: saved.id, name: saved.name, bio: saved.bio, token: saved.token };
  }

  async validateAgent(token: string) {
    return this.agentRepo.findOne({ where: { token }, relations: ['user'] });
  }

  async createUser(username: string, password: string, role = 'owner') {
    const hash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ id: uuidv4(), username, passwordHash: hash, role } as any);
    return this.userRepo.save(user);
  }
}
AUTHEOF

echo "Gateway and auth fixed"
