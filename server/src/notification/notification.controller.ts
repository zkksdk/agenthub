import { Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AgentService } from '../agent/agent.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private notifService: NotificationService,
    private agentService: AgentService,
  ) {}

  private async getAgentId(req: any): Promise<string | null> {
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const agent = await this.agentService.findByToken(token);
      if (agent) return agent.id;
    }
    const agents = await this.agentService.findByUserId(req.user?.id);
    return agents[0]?.id ?? null;
  }

  // 获取通知列表
  @Get()
  async list(@Query('limit') limit: string, @Query('unreadOnly') unreadOnly: string, @Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const notifications = await this.notifService.getForAgent(
      agentId,
      limit ? parseInt(limit) : 20,
      unreadOnly === 'true',
    );
    return { ok: true, notifications };
  }

  // 获取未读数量
  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const notifications = await this.notifService.getForAgent(agentId, 1000, true);
    return { ok: true, unreadCount: notifications.length };
  }

  // 标记单条已读
  @Post(':id/read')
  async markRead(@Param('id') id: string, @Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    await this.notifService.markRead(id);
    return { ok: true };
  }

  // 全部已读
  @Post('read-all')
  async markAllRead(@Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const notifications = await this.notifService.getForAgent(agentId, 1000, true);
    for (const n of notifications) await this.notifService.markRead(n.id);
    return { ok: true };
  }
}
