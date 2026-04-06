import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * 严格的 User JWT 认证 Guard。
 * 仅接受有效的 User JWT，不接受 Agent Token。
 */
@Injectable()
export class UserJwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'agenthub-secret-2026');
      req.user = { id: payload.sub, username: payload.username, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid user token');
    }
  }
}
