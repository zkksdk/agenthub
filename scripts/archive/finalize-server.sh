#!/bin/bash
BASE=/workspace/agenthub/server/src

# ===== Auth Module =====
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
    const saved = await this.agentRepo.save(agent);
    return { id: saved.id, name: saved.name, bio: saved.bio, token: saved.token };
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
  async register(@Body() body: { userId: string; name: string; bio?: string }) {
    const agent = await this.authService.registerAgent(body.userId, body.name, body.bio || '');
    return { ok: true, ...agent };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: any) {
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

# ===== Agent Module =====
cat > $BASE/agent/agent.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentGateway } from './agent.gateway';
import { MessageModule } from '../message/message.module';
import { GroupModule } from '../group/group.module';
import { FriendModule } from '../friend/friend.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([Agent]), MessageModule, GroupModule, FriendModule, NotificationModule],
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

  async findByToken(token: string) { return this.repo.findOne({ where: { token }, relations: ['user'] }); }
  async findById(id: string) { return this.repo.findOne({ where: { id } }); }
  async findByUserId(userId: string) { return this.repo.find({ where: { userId } }); }
  async findAll() { return this.repo.find({ relations: ['user'] }); }
  async findOnline() { return this.repo.find({ where: { status: 'online' } }); }

  async search(keyword: string) {
    return this.repo.createQueryBuilder('a')
      .where('a.name ILIKE :kw OR a.bio ILIKE :kw', { kw: `%${keyword}%` }).limit(20).getMany();
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

  async delete(id: string) { await this.repo.delete(id); }
  async update(id: string, data: Partial<Agent>) { await this.repo.update(id, data); return this.findById(id); }
}
EOF

cat > $BASE/agent/agent.controller.ts << 'EOF'
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agents')
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Get() async list() { const agents = await this.agentService.findAll(); return { ok: true, agents }; }
  @Get('online') async online() { const agents = await this.agentService.findOnline(); return { ok: true, agents }; }
  @Get('search') async search(@Query('keyword') keyword: string) { const agents = await this.agentService.search(keyword || ''); return { ok: true, agents }; }
  @Get(':id') async info(@Param('id') id: string) { const agent = await this.agentService.findById(id); return agent ? { ok: true, agent } : { ok: false, error: 'Not found' }; }
  @Post('register') async register(@Body() body: { userId: string; name: string; bio?: string }) { const agent = await this.agentService.register(body.userId, body.name, body.bio || ''); return { ok: true, ...agent }; }
  @Patch(':id') async update(@Param('id') id: string, @Body() body: { name?: string; bio?: string; avatar?: string }) { const agent = await this.agentService.updateInfo(id, body.name || '', body.bio || '', body.avatar || ''); return { ok: true, agent }; }
  @Delete(':id') async delete(@Param('id') id: string) { await this.agentService.delete(id); return { ok: true }; }
}
EOF

# ===== Message Module =====
cat > $BASE/message/message.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Message])],
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

  async save(data: any) {
    const msg = this.repo.create({ ...data, type: data.type || 'text' });
    return this.repo.save(msg);
  }

  async saveGroupMsg(data: any) { return this.save({ ...data, type: data.type || 'text' }); }

  async getHistory(params: any) {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.created_at', 'DESC').limit(params.limit || 50);
    if (params.groupId) qb.andWhere('m.group_id = :gid', { gid: params.groupId });
    if (params.peerId) qb.andWhere('((m.from_id = :pid AND m.to_id = :me) OR (m.from_id = :me AND m.to_id = :pid))', { pid: params.peerId, me: params.peerId });
    if (params.before) qb.andWhere('m.created_at < :before', { before: new Date(params.before) });
    if (params.after) qb.andWhere('m.created_at > :after', { after: new Date(params.after) });
    return (await qb.getMany()).reverse();
  }

  async getOfflineMessages(agentId: string, lastReadTime: number, limit = 50) {
    return this.repo.find({ where: [{ toId: agentId }], order: { createdAt: 'DESC' }, take: limit });
  }

  async markRead(messageIds: string[]) { await this.repo.update({ id: In(messageIds) }, { status: 'sent' }); }
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
    const messages = await this.messageService.getHistory({ peerId: q.peerId, groupId: q.groupId, limit: q.limit ? parseInt(q.limit) : 50, before: q.before ? parseInt(q.before) : undefined });
    return { ok: true, messages };
  }
}
EOF

# ===== Group Module =====
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
    return { id, name: data.name, bio: data.bio };
  }

  async findById(groupId: string) { return this.groupRepo.findOne({ where: { id: groupId } }); }
  async findByOwner(userId: string) { return this.groupRepo.find({ where: { ownerId: userId } }); }

  async getMembers(groupId: string) {
    const members = await this.memberRepo.find({ where: { groupId } });
    const result = [];
    for (const m of members) {
      const agent = await this.agentRepo.findOne({ where: { id: m.agentId } });
      result.push({ agentId: m.agentId, name: agent?.name, role: m.role, isBanned: m.isBanned, bannedUntil: m.bannedUntil });
    }
    return result;
  }

  async getMemberIds(groupId: string): Promise<string[]> { const m = await this.memberRepo.find({ where: { groupId } }); return m.map(x => x.agentId); }
  async addMember(groupId: string, agentId: string, actor: Agent) { const ex = await this.memberRepo.findOne({ where: { groupId, agentId } }); if (ex) return true; await this.memberRepo.save(this.memberRepo.create({ groupId, agentId, role: 'member', joinedAt: new Date() })); return true; }
  async removeMember(groupId: string, agentId: string, actor: Agent) { const m = await this.memberRepo.findOne({ where: { groupId, agentId } }); if (!m || m.role === 'owner') return false; await this.memberRepo.delete({ groupId, agentId }); return true; }
  async isMemberBanned(groupId: string, agentId: string) { const m = await this.memberRepo.findOne({ where: { groupId, agentId } }); if (!m) return false; if (m.isBanned && m.bannedUntil && new Date(m.bannedUntil) < new Date()) { await this.memberRepo.update({ groupId, agentId }, { isBanned: false }); return false; } return m.isBanned; }
  async banMember(groupId: string, agentId: string, duration: number, actor: Agent) { const bannedUntil = duration ? new Date(Date.now() + duration * 1000) : null; await this.memberRepo.update({ groupId, agentId }, { isBanned: true, bannedUntil }); }
  async unbanMember(groupId: string, agentId: string, actor: Agent) { await this.memberRepo.update({ groupId, agentId }, { isBanned: false, bannedUntil: null }); }
  async dissolve(groupId: string, actor: Agent) { await this.memberRepo.delete({ groupId }); await this.groupRepo.delete({ id: groupId }); }
  async transferOwner(groupId: string, newOwnerId: string, actor: Agent) { await this.memberRepo.update({ groupId, agentId: newOwnerId }, { role: 'owner' }); }
  async getBannedMembers(groupId: string) { return this.memberRepo.find({ where: { groupId, isBanned: true } }); }
}
EOF

# ===== Friend Module =====
cat > $BASE/friend/friend.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendRelation } from './entities/friend-relation.entity';
import { FriendRequest } from './entities/friend-request.entity';
import { FriendService } from './friend.service';

@Module({
  imports: [TypeOrmModule.forFeature([FriendRelation, FriendRequest])],
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
}
EOF

# ===== Notification Module (complete) =====
cat > $BASE/notification/notification.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
EOF

cat > $BASE/notification/notification.service.ts << 'EOF'
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
EOF

# ===== Admin Module (complete) =====
cat > $BASE/admin/admin.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Agent } from '../agent/entities/agent.entity';
import { ChatGroup } from '../group/entities/chat-group.entity';
import { GroupMember } from '../group/entities/group-member.entity';
import { Message } from '../message/entities/message.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Agent, ChatGroup, GroupMember, Message])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
EOF

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
    const users = await this.userRepo.find({ where: { role: 'owner' } });
    const result = [];
    for (const u of users) {
      const agents = await this.agentRepo.find({ where: { userId: u.id } });
      const groups = await this.groupRepo.find({ where: { ownerId: u.id } });
      result.push({ userId: u.id, username: u.username, status: u.status, agentCount: agents.length, groupCount: groups.length, agents, groups });
    }
    return result;
  }

  async getStats() {
    return { totalUsers: await this.userRepo.count({ where: { role: 'owner' } }), totalAgents: await this.agentRepo.count(), onlineAgents: await this.agentRepo.count({ where: { status: 'online' } }), totalGroups: await this.groupRepo.count(), totalMessages: await this.msgRepo.count() };
  }

  async createUser(username: string, password: string) { const hash = await bcrypt.hash(password, 10); const user = this.userRepo.create({ id: uuidv4(), username, passwordHash: hash, role: 'owner' }); return this.userRepo.save(user); }
  async deleteUser(userId: string) { await this.agentRepo.delete({ userId }); await this.userRepo.delete({ id: userId }); }
  async deleteAgent(agentId: string) { await this.agentRepo.delete({ id: agentId }); }
  async searchMessages(keyword: string, limit = 50) { return this.msgRepo.createQueryBuilder('m').where('m.content ILIKE :kw', { kw: `%${keyword}%` }).orderBy('m.created_at', 'DESC').limit(limit).getMany(); }
}
EOF

cat > $BASE/admin/admin.controller.ts << 'EOF'
import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}
  @Get('stats') async stats() { const s = await this.adminService.getStats(); return { ok: true, ...s }; }
  @Get('owners') async owners() { const o = await this.adminService.getOwners(); return { ok: true, owners: o }; }
  @Post('users') async createUser(@Body() body: { username: string; password: string }) { const u = await this.adminService.createUser(body.username, body.password); return { ok: true, userId: u.id }; }
  @Delete('users/:id') async deleteUser(@Param('id') id: string) { await this.adminService.deleteUser(id); return { ok: true }; }
  @Delete('agents/:id') async deleteAgent(@Param('id') id: string) { await this.adminService.deleteAgent(id); return { ok: true }; }
  @Get('messages/search') async searchMessages(@Query('keyword') keyword: string) { const msgs = await this.adminService.searchMessages(keyword || ''); return { ok: true, messages: msgs }; }
}
EOF

# ===== Media Module (complete) =====
cat > $BASE/media/media.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MediaController } from './media.controller';

@Module({ imports: [MulterModule.register({ dest: './uploads' })], controllers: [MediaController] })
export class MediaModule {}
EOF

cat > $BASE/media/media.controller.ts << 'EOF'
import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, Res, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('media')
export class MediaController {
  private uploadDir = './uploads';
  @Post('upload') @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { ok: false, error: 'No file' };
    return { ok: true, url: '/api/media/' + file.filename, filename: file.originalname, size: file.size, mimeType: file.mimetype };
  }
  @Get(':filename') serve(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(this.uploadDir, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');
    res.sendFile(path.resolve(filePath));
  }
}
EOF

# ===== JWT Guard (complete) =====
mkdir -p $BASE/common/guards
cat > $BASE/common/guards/jwt-auth.guard.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
EOF

# ===== .env.example =====
cat > $BASE/../.env.example << 'EOF'
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=agenthub
JWT_SECRET=agenthub-secret-2026-change-in-production
EOF

echo "All server files finalized!"
