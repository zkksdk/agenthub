#!/bin/bash
BASE=/workspace/agenthub/server/src

# Notification Module
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

  async create(agentId: string, type: string, title: string, content: string, data?: any) {
    const n = this.repo.create({ agentId, type, title, content, data });
    return this.repo.save(n);
  }

  async getForAgent(agentId: string, limit = 20, unreadOnly = false) {
    const where: any = { agentId };
    if (unreadOnly) where.isRead = false;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: limit });
  }

  async markRead(id: string) {
    await this.repo.update(id, { isRead: true });
  }
}
EOF

# Admin Module
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
    const totalUsers = await this.userRepo.count({ where: { role: 'owner' } });
    const totalAgents = await this.agentRepo.count();
    const onlineAgents = await this.agentRepo.count({ where: { status: 'online' } });
    const totalGroups = await this.groupRepo.count();
    const totalMessages = await this.msgRepo.count();
    return { totalUsers, totalAgents, onlineAgents, totalGroups, totalMessages };
  }

  async createUser(username: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ id: uuidv4(), username, passwordHash: hash, role: 'owner' });
    return this.userRepo.save(user);
  }

  async deleteUser(userId: string) {
    await this.agentRepo.delete({ userId });
    await this.userRepo.delete({ id: userId });
  }

  async deleteAgent(agentId: string) {
    await this.agentRepo.delete({ id: agentId });
  }

  async searchMessages(keyword: string, limit = 50) {
    return this.msgRepo.createQueryBuilder('m').where('m.content ILIKE :kw', { kw: '%' + keyword + '%' }).orderBy('m.created_at', 'DESC').limit(limit).getMany();
  }
}
EOF

cat > $BASE/admin/admin.controller.ts << 'EOF'
import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async stats() {
    const stats = await this.adminService.getStats();
    return { ok: true, ...stats };
  }

  @Get('owners')
  async owners() {
    const owners = await this.adminService.getOwners();
    return { ok: true, owners };
  }

  @Post('users')
  async createUser(@Body() body: { username: string; password: string }) {
    const user = await this.adminService.createUser(body.username, body.password);
    return { ok: true, userId: user.id };
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) { await this.adminService.deleteUser(id); return { ok: true }; }

  @Delete('agents/:id')
  async deleteAgent(@Param('id') id: string) { await this.adminService.deleteAgent(id); return { ok: true }; }

  @Get('messages/search')
  async searchMessages(@Query('keyword') keyword: string) {
    const messages = await this.adminService.searchMessages(keyword || '');
    return { ok: true, messages };
  }
}
EOF

# Media Module
cat > $BASE/media/media.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MediaController } from './media.controller';

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  controllers: [MediaController],
})
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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { ok: false, error: 'No file' };
    const url = '/api/media/' + file.filename;
    return { ok: true, url, filename: file.originalname, size: file.size, mimeType: file.mimetype };
  }

  @Get(':filename')
  serve(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(this.uploadDir, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');
    res.sendFile(path.resolve(filePath));
  }
}
EOF

# JWT Guard
mkdir -p $BASE/common/guards
cat > $BASE/common/guards/jwt-auth.guard.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
EOF

# .env.example
cat > $BASE/../.env.example << 'EOF'
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=agenthub
JWT_SECRET=agenthub-secret-2026-change-in-production
EOF

echo "All files created successfully"
