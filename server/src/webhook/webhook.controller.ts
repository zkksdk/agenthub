import { Controller, Get, Post, Delete, Body, Param, Req } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { AgentService } from '../agent/agent.service';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private webhookService: WebhookService,
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

  // 列出当前 Agent 的 webhook 注册
  @Get()
  async list(@Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const hooks = await this.webhookService.listByAgent(agentId);
    return { ok: true, webhooks: hooks };
  }

  // 注册 webhook
  @Post('register')
  async register(@Body() body: { url: string; events?: string[]; secret?: string }, @Req() req: any) {
    const { url, events, secret } = body;
    if (!url) return { ok: false, error: 'url required' };

    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };

    return this.webhookService.register(agentId, url, events, secret);
  }

  // 注销 webhook
  @Delete()
  async unregister(@Body() body: { url: string }, @Req() req: any) {
    const { url } = body;
    if (!url) return { ok: false, error: 'url required' };

    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };

    return this.webhookService.unregister(agentId, url);
  }
}
