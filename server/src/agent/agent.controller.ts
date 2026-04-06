import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { MessageService } from '../message/message.service';
import { UserJwtGuard } from '../common/guards/user-jwt.guard';
import { AgentTokenGuard } from '../common/guards/agent-token.guard';

@Controller('agents')
export class AgentController {
  constructor(
    private agentService: AgentService,
    private messageService: MessageService,
  ) {}

  // 列出当前用户的所有 Agent（User JWT 认证）
  @UseGuards(UserJwtGuard)
  @Get()
  async list(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) return { ok: false, error: 'Unauthorized' };
    const agents = await this.agentService.findByUserId(userId);
    return { ok: true, agents };
  }

  // 公开接口：列出所有 Agent（无认证）
  @Get('online')
  async online() {
    const agents = await this.agentService.findOnline();
    return { ok: true, agents };
  }

  // 公开接口：搜索 Agent
  @Get('search')
  async search(@Query('keyword') keyword: string) {
    const agents = await this.agentService.search(keyword || '');
    // 过滤掉 token 字段再返回
    const sanitized = agents.map(({ token: _t, ...rest }) => rest);
    return { ok: true, agents: sanitized };
  }

  // 公开接口：查看任意 Agent 信息（不含 token）
  @Get(':id')
  async info(@Param('id') id: string) {
    const agent = await this.agentService.findById(id);
    if (!agent) return { ok: false, error: 'Not found' };
    const { token: _t, ...pub } = agent;
    return { ok: true, agent: pub };
  }

  // 创建 Agent（需要 User JWT）
  @UseGuards(UserJwtGuard)
  @Post('register')
  async register(@Body() body: { name?: string; bio?: string }, @Req() req: any) {
    const userId = req.user.id;
    let name = body.name?.trim();
    if (!name || name.length === 0) return { ok: false, error: '名称不能为空' };
    if (name.length > 30) return { ok: false, error: '名称不能超过 30 字符' };
    const existing = await this.agentService.findByName(name);
    if (existing) return { ok: false, error: '该名称已被使用' };
    const bio = (body.bio?.trim().slice(0, 200)) || '';
    const agent = await this.agentService.register(userId, name, bio);
    return { ok: true, ...agent };
  }

  // 更新 Agent 信息（Agent Token）
  @UseGuards(AgentTokenGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; bio?: string; avatar?: string }, @Req() req: any) {
    const agent: any = req.user?.agent;
    if (!agent || agent.id !== id) return { ok: false, error: '无权限' };
    if (body.name !== undefined && body.name.trim().length > 30) return { ok: false, error: '名称不能超过 30 字符' };
    if (body.bio !== undefined && body.bio.trim().length > 200) body.bio = body.bio.trim().slice(0, 200);
    if (body.name?.trim()) {
      const existing = await this.agentService.findByName(body.name.trim());
      if (existing && existing.id !== id) return { ok: false, error: '该名称已被其他 Agent 使用' };
    }
    const updated = await this.agentService.updateInfo(
      id,
      body.name?.trim() || agent.name,
      body.bio?.trim() ?? agent.bio,
      body.avatar || agent.avatar || '',
    );
    return { ok: true, agent: updated };
  }

  // 删除 Agent（User JWT）
  @UseGuards(UserJwtGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    const target = await this.agentService.findById(id);
    if (!target) return { ok: false, error: 'Agent 不存在' };
    if (target.userId !== req.user.id) return { ok: false, error: '无权限' };
    await this.agentService.delete(id);
    return { ok: true };
  }

  // 发送私聊消息（Agent Token）
  @UseGuards(AgentTokenGuard)
  @Post('send')
  async send(@Body() body: { to?: string; toId?: string; content: string; type?: string }, @Req() req: any) {
    const agent: any = req.user?.agent;
    if (!agent) return { ok: false, error: 'Agent not found' };

    const toId = body.to || body.toId;
    if (!toId) return { ok: false, error: '缺少目标 Agent ID（to 或 toId）' };
    if (!body.content?.trim()) return { ok: false, error: '消息内容不能为空' };

    const msg = await this.messageService.save({
      fromId: agent.id,
      toId,
      content: body.content,
      type: body.type || 'text',
    });

    // WebSocket 推送（如果对方在线）
    const gateway = (global as any).__agenthub_gateway;
    if (gateway) {
      gateway.sendToAgent(toId, {
        fromId: agent.id,
        fromName: agent.name,
        content: body.content,
        type: body.type || 'text',
        messageId: msg.id,
      });
    }

    return { ok: true, fromId: agent.id, toId, content: body.content, messageId: msg.id };
  }
}
