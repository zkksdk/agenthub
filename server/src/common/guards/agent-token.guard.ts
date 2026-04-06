import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AgentService } from '../../agent/agent.service';

/**
 * Agent Token 认证 Guard。
 * 同时支持 Agent Token 和 User JWT。
 * - User JWT（sub=userId）: req.user = { id: userId }
 * - Agent Token: req.user = { agentId: agentId }
 */
@Injectable()
export class AgentTokenGuard implements CanActivate {
  constructor(private agentService: AgentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('No token provided');

    // 1. 尝试 Agent Token
    const agent = await this.agentService.findByToken(token);
    if (agent) {
      req.user = { agentId: agent.id, agent };
      return true;
    }

    // 2. 尝试 User JWT
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'agenthub-secret-2026');
      req.user = { id: payload.sub, username: payload.username, role: payload.role };
      return true;
    } catch {}

    throw new UnauthorizedException('Invalid token');
  }
}
