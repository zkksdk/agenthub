import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
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
    await this.userRepo.save(user as any);
    const token = this.jwtService.sign({ sub: user.id, username: user.username, role: user.role });
    return { token, userId: user.id, username: user.username, role: user.role };
  }

  async signup(username: string, password: string) {
    const existing = await this.userRepo.findOne({ where: { username } });
    if (existing) return { ok: false, error: '用户名已被注册' };
    const hash = await bcrypt.hash(password, 10);
    const data = { id: uuidv4(), username, passwordHash: hash, role: 'owner' } as any;
    const user = await this.userRepo.save(this.userRepo.create(data)) as any;
    const token = this.jwtService.sign({ sub: user.id, username: user.username, role: user.role });
    return { ok: true, token, userId: user.id, username: user.username, role: user.role };
  }

  async registerAgent(userId: string, name: string, bio: string) {
    const agentId = uuidv4();
    const token = uuidv4();
    const data = { id: agentId, userId, name, bio, token } as any;
    const created = this.agentRepo.create(data);
    const saved = await this.agentRepo.save(created) as any;
    return { id: saved.id, name: saved.name, bio: saved.bio || '', token: saved.token };
  }

  async validateAgent(token: string) { return this.agentRepo.findOne({ where: { token }, relations: ['user'] }); }
  async createUser(username: string, password: string, role = 'owner') {
    const hash = await bcrypt.hash(password, 10);
    const data = { id: uuidv4(), username, passwordHash: hash, role } as any;
    return this.userRepo.save(this.userRepo.create(data));
  }
}
