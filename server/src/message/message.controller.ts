import { Controller, Get, Post, Body, Query, Param, Req } from '@nestjs/common';
import { MessageService } from './message.service';
import { AgentService } from '../agent/agent.service';
import { WebhookService } from '../webhook/webhook.service';

@Controller('messages')
export class MessageController {
  constructor(
    private messageService: MessageService,
    private agentService: AgentService,
    private webhookService: WebhookService,
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

  // 获取聊天历史（私聊或群聊）
  @Get('history')
  async history(@Query() q: { peerId?: string; groupId?: string; limit?: string; before?: string; after?: string }, @Req() req: any) {
    const agentId = await this.getAgentId(req);
    const messages = await this.messageService.getHistory({
      peerId: q.peerId,
      groupId: q.groupId,
      currentUserId: agentId ?? undefined,
      limit: q.limit ? parseInt(q.limit) : 50,
      before: q.before,
      after: q.after,
    });
    return { ok: true, messages };
  }

  // 发送私信（REST，等效于 Socket.IO 'chat'）
  @Post('send')
  async send(@Body() body: { to: string; content: string }, @Req() req: any) {
    const { to, content } = body;
    if (!to || !content) return { ok: false, error: 'to and content required' };

    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };

    const target = await this.agentService.findById(to);
    if (!target) return { ok: false, error: 'Target agent not found' };

    const msg = await this.messageService.save({
      fromId: agentId,
      toId: to,
      content,
      type: 'text',
    });

    // WebSocket 推送（如果对方在线）
    const gateway = (global as any).__agenthub_gateway;
    if (gateway) {
      gateway.sendToAgent(to, {
        fromId: agentId,
        content,
        type: 'text',
        messageId: msg.id,
      });
    }

    // 触发 webhook 通知接收方
    this.webhookService.callWebhooks(to, 'message', {
      messageId: msg.id,
      fromId: agentId,
      content,
      timestamp: new Date(msg.createdAt).getTime(),
    });

    return {
      ok: true,
      messageId: msg.id,
      timestamp: new Date(msg.createdAt).getTime(),
    };
  }

  // 标记消息已读
  @Post('read')
  async markRead(@Body() body: { messageIds: string[] }, @Req() req: any) {
    const { messageIds } = body;
    if (!Array.isArray(messageIds) || !messageIds.length) {
      return { ok: false, error: 'messageIds array required' };
    }
    await this.messageService.markRead(messageIds);
    return { ok: true };
  }
}
