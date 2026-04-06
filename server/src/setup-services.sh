#!/bin/bash
BASE=/workspace/agenthub/server/src

# Auth Module
cat > $BASE/auth/auth.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../user/entities/user.entity';
import { Agent } from '../agent/entities/agent.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Agent]),
    PassportModule,
    JwtModule.register({ secret: process.env.JWT_SECRET || 'agenthub-secret-2026', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
EOF

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
    await this.userRepo.save(user);
    const token = this.jwtService.sign({ sub: user.id, username: user.username, role: user.role });
    return { token, userId: user.id, username: user.username, role: user.role };
  }

  async registerAgent(userId: string, name: string, bio: string) {
    const agentId = uuidv4();
    const token = uuidv4();
    const agent = this.agentRepo.create({ id: agentId, userId, name, bio, token });
    await this.agentRepo.save(agent);
    return { id: agentId, name, bio, token };
  }

  async validateAgent(token: string) {
    return this.agentRepo.findOne({ where: { token }, relations: ['user'] });
  }

  async createUser(username: string, password: string, role = 'owner') {
    const hash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ id: uuidv4(), username, passwordHash: hash, role });
    return this.userRepo.save(user);
  }
}
EOF

cat > $BASE/auth/auth.controller.ts << 'EOF'
import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { userId: string; password: string }) {
    const result = await this.authService.login(body.userId, body.password);
    return result ? { ok: true, ...result } : { ok: false, error: 'Invalid credentials' };
  }

  @Post('register')
  async register(@Body() body: { userId: string; password: string; name: string; bio?: string }) {
    const existing = await this.authService.registerAgent(body.userId, body.name, body.bio || '');
    return { ok: true, ...existing };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req) {
    return { ok: true, user: req.user };
  }
}
EOF

cat > $BASE/auth/jwt.strategy.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'agenthub-secret-2026',
    });
  }

  async validate(payload: any) {
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
EOF

# Agent Module
cat > $BASE/agent/agent.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentGateway } from './agent.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Agent])],
  controllers: [AgentController],
  providers: [AgentService, AgentGateway],
  exports: [AgentService],
})
export class AgentModule {}
EOF

cat > $BASE/agent/agent.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AgentService {
  constructor(@InjectRepository(Agent) private repo: Repository<Agent>) {}

  async register(userId: string, name: string, bio: string) {
    const id = uuidv4();
    const token = uuidv4();
    const agent = this.repo.create({ id, userId, name, bio, token });
    const saved = await this.repo.save(agent);
    return { id: saved.id, name: saved.name, bio: saved.bio, token: saved.token };
  }

  async findByToken(token: string) {
    return this.repo.findOne({ where: { token }, relations: ['user'] });
  }

  async findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findByUserId(userId: string) {
    return this.repo.find({ where: { userId } });
  }

  async findAll() {
    return this.repo.find({ relations: ['user'] });
  }

  async findOnline() {
    return this.repo.find({ where: { status: 'online' } });
  }

  async search(keyword: string) {
    return this.repo.createQueryBuilder('a')
      .where('a.name ILIKE :kw OR a.bio ILIKE :kw', { kw: `%${keyword}%` })
      .limit(20).getMany();
  }

  async updateStatus(id: string, status: 'online' | 'offline') {
    await this.repo.update(id, { status, lastActiveAt: new Date() });
  }

  async updateLastReadTime(id: string, time: number) {
    await this.repo.update(id, { lastReadTime: time });
  }

  async updateInfo(id: string, name: string, bio: string, avatar: string) {
    await this.repo.update(id, { name, bio, avatar });
    return this.findById(id);
  }

  async delete(id: string) {
    await this.repo.delete(id);
  }

  async update(id: string, data: Partial<Agent>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }
}
EOF

cat > $BASE/agent/agent.controller.ts << 'EOF'
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('agents')
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Get()
  async list() {
    const agents = await this.agentService.findAll();
    return { ok: true, agents };
  }

  @Get('online')
  async online() {
    const agents = await this.agentService.findOnline();
    return { ok: true, agents };
  }

  @Get('search')
  async search(@Query('keyword') keyword: string) {
    const agents = await this.agentService.search(keyword || '');
    return { ok: true, agents };
  }

  @Get(':id')
  async info(@Param('id') id: string) {
    const agent = await this.agentService.findById(id);
    return agent ? { ok: true, agent } : { ok: false, error: 'Not found' };
  }

  @Post('register')
  async register(@Body() body: { userId: string; name: string; bio?: string }) {
    const agent = await this.agentService.register(body.userId, body.name, body.bio || '');
    return { ok: true, ...agent };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; bio?: string; avatar?: string }) {
    const agent = await this.agentService.updateInfo(id, body.name || '', body.bio || '', body.avatar || '');
    return { ok: true, agent };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.agentService.delete(id);
    return { ok: true };
  }
}
EOF

# Agent Gateway (WebSocket)
cat > $BASE/agent/agent.gateway.ts << 'EOF'
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AgentService } from './agent.service';
import { MessageService } from '../message/message.service';
import { GroupService } from '../group/group.service';
import { FriendService } from '../friend/friend.service';
import { NotificationService } from '../notification/notification.service';

@WebSocketGateway({ cors: { origin: '*' }, path: '/ws' })
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private agentSockets = new Map<string, string>(); // agentId -> socketId
  private socketAgents = new Map<string, string>();  // socketId -> agentId

  constructor(
    private jwtService: JwtService,
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
      const agent = await this.agentService.findByToken(token);
      if (!agent) { socket.disconnect(); return; }
      this.agentSockets.set(agent.id, socket.id);
      this.socketAgents.set(socket.id, agent.id);
      await this.agentService.updateStatus(agent.id, 'online');
      socket.data.agent = agent;
      this.server.emit('push.friend_status', { agentId: agent.id, agentName: agent.name, status: 'online', timestamp: Date.now() });
      socket.emit('auth_success', { agentId: agent.id, role: agent.user?.role });
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

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket) {
    socket.emit('pong');
  }

  @SubscribeMessage('chat')
  async handleChat(@ConnectedSocket() socket: Socket, @MessageBody() data: { to: string; content: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const target = await this.agentService.findById(data.to);
    const msg = await this.messageService.save({ fromId: agent.id, toId: data.to, content: data.content, type: 'text' });
    const pushData = { messageId: msg.id, from: { agentId: agent.id, agentName: agent.name }, to: { agentId: target?.id, agentName: target?.name }, content: data.content, timestamp: Date.now() };
    socket.emit('push.ack', { messageId: msg.id, timestamp: msg.createdAt });
    const targetSocketId = this.agentSockets.get(data.to);
    if (targetSocketId) this.server.to(targetSocketId).emit('push.chat', pushData);
    return { ok: true, data: { messageId: msg.id, timestamp: msg.createdAt.getTime() } };
  }

  @SubscribeMessage('group_chat')
  async handleGroupChat(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; content: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const isBanned = await this.groupService.isMemberBanned(data.groupId, agent.id);
    if (isBanned) return { ok: false, error: 'You are banned' };
    const group = await this.groupService.findById(data.groupId);
    const msg = await this.messageService.saveGroupMsg({ fromId: agent.id, groupId: data.groupId, content: data.content, type: 'text' });
    const pushData = { messageId: msg.id, from: { agentId: agent.id, agentName: agent.name }, groupId: data.groupId, groupName: group?.name, content: data.content, timestamp: Date.now() };
    const members = await this.groupService.getMemberIds(data.groupId);
    for (const memberId of members) {
      const sid = this.agentSockets.get(memberId);
      if (sid) this.server.to(sid).emit('push.group_chat', pushData);
    }
    return { ok: true, data: { messageId: msg.id, timestamp: msg.createdAt.getTime() } };
  }

  @SubscribeMessage('group.create')
  async handleCreateGroup(@ConnectedSocket() socket: Socket, @MessageBody() data: { name: string; bio?: string; memberIds?: string[] }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const group = await this.groupService.create({ ownerId: agent.userId, name: data.name, bio: data.bio || '', memberIds: data.memberIds || [] });
    return { ok: true, data: group };
  }

  @SubscribeMessage('group.invite')
  async handleInvite(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; targetId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const result = await this.groupService.addMember(data.groupId, data.targetId, agent);
    if (result) {
      const targetSocketId = this.agentSockets.get(data.targetId);
      const group = await this.groupService.findById(data.groupId);
      if (targetSocketId) this.server.to(targetSocketId).emit('push.group_invite', { groupId: data.groupId, groupName: group?.name, from: { agentId: agent.id, agentName: agent.name }, timestamp: Date.now() });
    }
    return { ok: result };
  }

  @SubscribeMessage('group.remove')
  async handleRemove(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; targetId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const result = await this.groupService.removeMember(data.groupId, data.targetId, agent);
    return { ok: result };
  }

  @SubscribeMessage('group.ban')
  async handleBan(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; targetId: string; duration?: number }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    await this.groupService.banMember(data.groupId, data.targetId, data.duration, agent);
    return { ok: true };
  }

  @SubscribeMessage('group.unban')
  async handleUnban(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; targetId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    await this.groupService.unbanMember(data.groupId, data.targetId, agent);
    return { ok: true };
  }

  @SubscribeMessage('group.dissolve')
  async handleDissolve(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    await this.groupService.dissolve(data.groupId, agent);
    return { ok: true };
  }

  @SubscribeMessage('group.transfer')
  async handleTransfer(@ConnectedSocket() socket: Socket, @MessageBody() data: { groupId: string; newOwnerId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    await this.groupService.transferOwner(data.groupId, data.newOwnerId, agent);
    return { ok: true };
  }

  @SubscribeMessage('friend.request')
  async handleFriendRequest(@ConnectedSocket() socket: Socket, @MessageBody() data: { toId: string; message?: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const result = await this.friendService.sendRequest(agent.id, data.toId, data.message || '');
    const targetSocketId = this.agentSockets.get(data.toId);
    if (targetSocketId) this.server.to(targetSocketId).emit('push.friend_request', { requestId: result.id, from: { agentId: agent.id, agentName: agent.name }, message: data.message, timestamp: Date.now() });
    return { ok: true, data: { requestId: result.id } };
  }

  @SubscribeMessage('friend.accept')
  async handleFriendAccept(@ConnectedSocket() socket: Socket, @MessageBody() data: { requestId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    await this.friendService.acceptRequest(data.requestId, agent.id);
    return { ok: true };
  }

  @SubscribeMessage('friend.reject')
  async handleFriendReject(@ConnectedSocket() socket: Socket, @MessageBody() data: { requestId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    await this.friendService.rejectRequest(data.requestId, agent.id);
    return { ok: true };
  }

  @SubscribeMessage('friend.remove')
  async handleFriendRemove(@ConnectedSocket() socket: Socket, @MessageBody() data: { friendId: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    await this.friendService.removeFriend(agent.id, data.friendId);
    return { ok: true };
  }

  @SubscribeMessage('message.history')
  async handleHistory(@ConnectedSocket() socket: Socket, @MessageBody() data: { peerId?: string; groupId?: string; limit?: number; before?: number }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
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

  @SubscribeMessage('group.list')
  async handleGroupList(@ConnectedSocket() socket: Socket) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
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

  @SubscribeMessage('friend.list')
  async handleFriendList(@ConnectedSocket() socket: Socket) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const friends = await this.friendService.getFriends(agent.id);
    return { ok: true, data: { friends } };
  }

  @SubscribeMessage('friend.requests_received')
  async handleReceivedRequests(@ConnectedSocket() socket: Socket) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const requests = await this.friendService.getReceivedRequests(agent.id);
    return { ok: true, data: { requests } };
  }

  @SubscribeMessage('agent.my_info')
  async handleMyInfo(@ConnectedSocket() socket: Socket) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    return { ok: true, data: { agent: { id: agent.id, name: agent.name, bio: agent.bio, avatar: agent.avatar, status: agent.status } } };
  }

  @SubscribeMessage('agent.update')
  async handleUpdate(@ConnectedSocket() socket: Socket, @MessageBody() data: { name?: string; bio?: string; avatar?: string }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const updated = await this.agentService.updateInfo(agent.id, data.name || agent.name, data.bio ?? agent.bio, data.avatar || agent.avatar);
    return { ok: true, data: { agent: updated } };
  }

  @SubscribeMessage('notification.list')
  async handleNotifList(@ConnectedSocket() socket: Socket, @MessageBody() data: { limit?: number; unreadOnly?: boolean }) {
    const agent: any = socket.data.agent;
    if (!agent) return { ok: false, error: 'Unauthorized' };
    const notifs = await this.notifService.getForAgent(agent.id, data.limit || 20, data.unreadOnly);
    return { ok: true, data: { notifications: notifs } };
  }

  @SubscribeMessage('notification.read')
  async handleNotifRead(@ConnectedSocket() socket: Socket, @MessageBody() data: { notificationId: string }) {
    await this.notifService.markRead(data.notificationId);
    return { ok: true };
  }
}
EOF

# Message Module
cat > $BASE/message/message.module.ts << 'EOF'
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), forwardRef(() => AgentModule)],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
EOF

cat > $BASE/message/message.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessageService {
  constructor(@InjectRepository(Message) private repo: Repository<Message>) {}

  async save(data: { fromId: string; toId?: string; groupId?: string; content: string; type?: string; mediaUrl?: string; fileName?: string; fileSize?: number }) {
    const msg = this.repo.create({ ...data, type: data.type || 'text' });
    return this.repo.save(msg);
  }

  async saveGroupMsg(data: { fromId: string; groupId: string; content: string; type?: string }) {
    return this.save({ ...data, type: data.type || 'text' });
  }

  async getHistory(params: { peerId?: string; groupId?: string; limit?: number; before?: number; after?: number }) {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.created_at', 'DESC').limit(params.limit || 50);
    if (params.groupId) qb.andWhere('m.group_id = :gid', { gid: params.groupId });
    if (params.peerId) {
      qb.andWhere('((m.from_id = :pid AND m.to_id = :me) OR (m.from_id = :me AND m.to_id = :pid))', { pid: params.peerId, me: params.peerId });
    }
    if (params.before) qb.andWhere('m.created_at < :before', { before: new Date(params.before) });
    if (params.after) qb.andWhere('m.created_at > :after', { after: new Date(params.after) });
    const msgs = await qb.getMany();
    return msgs.reverse();
  }

  async getOfflineMessages(agentId: string, lastReadTime: number, limit = 50) {
    return this.repo.find({ where: [{ toId: agentId, createdAt: LessThan(new Date(lastReadTime)) }], order: { createdAt: 'DESC' }, take: limit });
  }

  async markRead(messageIds: string[]) {
    await this.repo.update({ id: In(messageIds) }, { status: 'sent' });
  }
}
EOF

cat > $BASE/message/message.controller.ts << 'EOF'
import { Controller, Get, Query } from '@nestjs/common';
import { MessageService } from './message.service';

@Controller('messages')
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Get('history')
  async history(@Query() q: { peerId?: string; groupId?: string; limit?: string; before?: string }) {
    const messages = await this.messageService.getHistory({
      peerId: q.peerId, groupId: q.groupId,
      limit: q.limit ? parseInt(q.limit) : 50,
      before: q.before ? parseInt(q.before) : undefined,
    });
    return { ok: true, messages };
  }
}
EOF

# Group Module
cat > $BASE/group/group.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGroup } from './entities/chat-group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupService } from './group.service';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatGroup, GroupMember]), AgentModule],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
EOF

cat > $BASE/group/group.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatGroup } from './entities/chat-group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Agent } from '../agent/entities/agent.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(ChatGroup) private groupRepo: Repository<ChatGroup>,
    @InjectRepository(GroupMember) private memberRepo: Repository<GroupMember>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
  ) {}

  async create(data: { ownerId: string; name: string; bio?: string; memberIds?: string[] }) {
    const id = uuidv4();
    const group = this.groupRepo.create({ id, ownerId: data.ownerId, name: data.name, bio: data.bio || '', type: 'group' });
    await this.groupRepo.save(group);
    const ownerAgent = await this.agentRepo.findOne({ where: { userId: data.ownerId } });
    if (ownerAgent) {
      await this.memberRepo.save(this.memberRepo.create({ groupId: id, agentId: ownerAgent.id, role: 'owner', joinedAt: new Date() }));
    }
    for (const memberId of (data.memberIds || [])) {
      await this.memberRepo.save(this.memberRepo.create({ groupId: id, agentId: memberId, role: 'member', joinedAt: new Date() }));
    }
    return { id, name: data.name, bio: data.bio };
  }

  async findById(groupId: string) {
    return this.groupRepo.findOne({ where: { id: groupId } });
  }

  async findByOwner(userId: string) {
    const groups = await this.groupRepo.find({ where: { ownerId: userId } });
    for (const g of groups) {
      const members = await this.getMembers(g.id);
      (g as any).memberCount = members.length;
    }
    return groups;
  }

  async getMembers(groupId: string) {
    const members = await this.memberRepo.find({ where: { groupId } });
    const result = [];
    for (const m of members) {
      const agent = await this.agentRepo.findOne({ where: { id: m.agentId } });
      result.push({ agentId: m.agentId, name: agent?.name, role: m.role, isBanned: m.isBanned, bannedUntil: m.bannedUntil });
    }
    return result;
  }

  async getMemberIds(groupId: string): Promise<string[]> {
    const members = await this.memberRepo.find({ where: { groupId } });
    return members.map(m => m.agentId);
  }

  async addMember(groupId: string, agentId: string, actor: Agent) {
    const member = await this.memberRepo.findOne({ where: { groupId, agentId } });
    if (member) return true;
    await this.memberRepo.save(this.memberRepo.create({ groupId, agentId, role: 'member', joinedAt: new Date() }));
    return true;
  }

  async removeMember(groupId: string, agentId: string, actor: Agent) {
    const member = await this.memberRepo.findOne({ where: { groupId, agentId } });
    if (!member || member.role === 'owner') return false;
    await this.memberRepo.delete({ groupId, agentId });
    return true;
  }

  async isMemberBanned(groupId: string, agentId: string) {
    const member = await this.memberRepo.findOne({ where: { groupId, agentId } });
    if (!member) return false;
    if (member.isBanned && member.bannedUntil && new Date(member.bannedUntil) < new Date()) {
      await this.memberRepo.update({ groupId, agentId }, { isBanned: false });
      return false;
    }
    return member.isBanned;
  }

  async banMember(groupId: string, agentId: string, duration: number, actor: Agent) {
    const bannedUntil = duration ? new Date(Date.now() + duration * 1000) : null;
    await this.memberRepo.update({ groupId, agentId }, { isBanned: true, bannedUntil });
  }

  async unbanMember(groupId: string, agentId: string, actor: Agent) {
    await this.memberRepo.update({ groupId, agentId }, { isBanned: false, bannedUntil: null });
  }

  async dissolve(groupId: string, actor: Agent) {
    await this.memberRepo.delete({ groupId });
    await this.groupRepo.delete({ id: groupId });
  }

  async transferOwner(groupId: string, newOwnerId: string, actor: Agent) {
    await this.memberRepo.update({ groupId, agentId: newOwnerId }, { role: 'owner' });
    await this.groupRepo.update(groupId, { ownerId: actor.userId });
  }

  async getBannedMembers(groupId: string) {
    return this.memberRepo.find({ where: { groupId, isBanned: true } });
  }
}
EOF

# Friend Module
cat > $BASE/friend/friend.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendRelation } from './entities/friend-relation.entity';
import { FriendRequest } from './entities/friend-request.entity';
import { FriendService } from './friend.service';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [TypeOrmModule.forFeature([FriendRelation, FriendRequest]), AgentModule],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
EOF

cat > $BASE/friend/friend.service.ts << 'EOF'
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
    const existing = await this.reqRepo.findOne({ where: { fromId, toId } });
    if (existing) return existing;
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


  async rejectRequest(requestId: string, agentId: string) {
    await this.reqRepo.update(requestId, { status: 'rejected' });
  }

  async removeFriend(agentId: string, friendId: string) {
    await this.relRepo.delete({ agentId, friendId });
    await this.relRepo.delete({ agentId: friendId, friendId: agentId });
  }

  async getFriends(agentId: string) {
    const rels = await this.relRepo.find({ where: { agentId, status: 'accepted' } });
    return rels;
  }

  async getReceivedRequests(agentId: string) {
    return this.reqRepo.find({ where: { toId: agentId, status: 'pending' } });
  }
}
