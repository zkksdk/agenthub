import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AgentService } from './agent.service';
import { MessageService } from '../message/message.service';
import { GroupService } from '../group/group.service';
import { FriendService } from '../friend/friend.service';
import { NotificationService } from '../notification/notification.service';
import { WebhookService } from '../webhook/webhook.service';

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
    private webhookService: WebhookService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) { socket.disconnect(); return; }
      let agent: any = await this.agentService.findByToken(token);
      // fallback: 如果 token 是 User JWT，从 userId 找第一个 Agent
      if (!agent) {
        try {
          const jwt = require('jsonwebtoken');
          const payload = jwt.verify(token, process.env.JWT_SECRET || 'agenthub-secret');
          const agents = await this.agentService.findByUserId(payload.id || payload.sub);
          agent = agents[0];
        } catch {}
      }
      if (!agent) { socket.disconnect(); return; }
      this.agentSockets.set(agent.id, socket.id);
      this.socketAgents.set(socket.id, agent.id);
      await this.agentService.updateStatus(agent.id, 'online');
      (global as any).__agenthub_gateway = this;
      socket.data.agent = agent;
      this.server.emit('push.friend_status', { agentId: agent.id, agentName: agent.name, status: 'online', timestamp: Date.now() });
      socket.emit('auth_success', { agentId: agent.id });
    } catch { socket.disconnect(); }
  }

  async handleDisconnect(socket: Socket) {
    const agentId = this.socketAgents.get(socket.id);
    if (agentId) {
      await this.agentService.updateStatus(agentId, 'offline');
      await this.agentService.updateLastSeen(agentId);
      this.server.emit('push.friend_status', { agentId, status: 'offline', timestamp: Date.now() });
      this.agentSockets.delete(agentId);
      this.socketAgents.delete(socket.id);
    }
  }

  private getSocketId(agentId: string) { return this.agentSockets.get(agentId); }

  // 供 REST fallback 调用
  sendToAgent(agentId: string, data: any) {
    const sid = this.getSocketId(agentId);
    if (sid) this.server.to(sid).emit('push.chat', data);
  }

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
    // 触发 webhook（发给目标 Agent 的已注册 URL）
    this.webhookService.callWebhooks(data.to, 'message', {
      messageId: msg.id,
      fromId: agent.id,
      fromName: agent.name,
      content: data.content,
      timestamp: new Date(msg.createdAt).getTime(),
    });
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
    // 触发 webhook（发给每个成员已注册的 URL）
    for (const mid of members) {
      this.webhookService.callWebhooks(mid, 'group_message', {
        messageId: msg.id,
        fromId: agent.id,
        fromName: agent.name,
        groupId: data.groupId,
        groupName: group?.name,
        content: data.content,
        timestamp: new Date(msg.createdAt).getTime(),
      });
    }
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
    await this.groupService.addMember(data.groupId, data.targetId);
    const group = await this.groupService.findById(data.groupId);
    const sid = this.getSocketId(data.targetId);
    if (sid) this.server.to(sid).emit('push.group_invite', { groupId: data.groupId, groupName: group?.name, from: { agentId: agent.id, agentName: agent.name }, timestamp: Date.now() });
    this.webhookService.callWebhooks(data.targetId, 'group_invite', {
      groupId: data.groupId,
      groupName: group?.name,
      fromId: agent.id,
      fromName: agent.name,
      timestamp: Date.now(),
    });
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
    const groups = await this.groupService.findByMember(agent.id);
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
    // 触发 webhook
    this.webhookService.callWebhooks(data.toId, 'friend_request', {
      requestId: result.id,
      fromId: agent.id,
      fromName: agent.name,
      message: data.message,
      timestamp: Date.now(),
    });
    return { ok: true, data: { requestId: result.id } };
  }

  @SubscribeMessage('friend.accept')
  async handleFriendAccept(@ConnectedSocket() socket: Socket, @MessageBody() data: { requestId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false };
    // 获取请求方 agentId 用于 webhook
    const requests = await this.friendService.getReceivedRequests(agent.id);
    const req = requests.find((r: any) => r.id === data.requestId);
    await this.friendService.acceptRequest(data.requestId, agent.id);
    // 通知请求方
    if (req) {
      const sid = this.getSocketId(req.fromId);
      if (sid) this.server.to(sid).emit('push.friend_accepted', { fromId: agent.id, fromName: agent.name, timestamp: Date.now() });
      this.webhookService.callWebhooks(req.fromId, 'friend_accepted', {
        fromId: agent.id,
        fromName: agent.name,
        timestamp: Date.now(),
      });
    }
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
    const messages = await this.messageService.getHistory({
      peerId: data.peerId,
      groupId: data.groupId,
      currentUserId: agent.id,
      limit: data.limit || 50,
      before: data.before ? String(data.before) : undefined,
    });
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
