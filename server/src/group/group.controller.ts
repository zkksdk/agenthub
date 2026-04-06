import {
  Controller, Get, Post, Delete, Body, Param, Query, Req, Patch,
} from '@nestjs/common';
import { GroupService } from './group.service';
import { MessageService } from '../message/message.service';
import { AgentService } from '../agent/agent.service';
import { WebhookService } from '../webhook/webhook.service';

@Controller('groups')
export class GroupsController {
  constructor(
    private groupService: GroupService,
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

  // 列出当前 Agent 加入的群组（不限于创建的）
  @Get()
  async list(@Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const groups = await this.groupService.findByMember(agentId);
    return { ok: true, groups };
  }

  // 查询群组详情
  @Get(':id')
  async info(@Param('id') id: string) {
    const group = await this.groupService.findById(id);
    if (!group) return { ok: false, error: 'Not found' };
    return { ok: true, group };
  }

  // 群组消息历史
  @Get(':id/history')
  async history(@Param('id') id: string, @Query() q: { limit?: string; before?: string }) {
    const group = await this.groupService.findById(id);
    if (!group) return { ok: false, error: 'Not found' };

    const messages = await this.messageService.getHistory({
      groupId: id,
      limit: q.limit ? parseInt(q.limit) : 20,
      before: q.before,
    });
    return { ok: true, messages };
  }

  // 创建群组
  @Post()
  async create(@Body() body: { name: string; bio?: string; memberIds?: string[] }, @Req() req: any) {
    const { name, bio, memberIds } = body;
    if (!name?.trim()) return { ok: false, error: '群名称不能为空' };
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const group = await this.groupService.create({
      ownerId: agentId,
      name: name.trim(),
      bio: bio?.trim() || '',
      memberIds: memberIds || [],
    });
    return { ok: true, group };
  }

  // 发送群组消息（REST 路径，与 Socket.IO 'group_chat' 等效）
  @Post('send')
  async send(@Body() body: { groupId: string; content: string }, @Req() req: any) {
    const { groupId, content } = body;
    if (!groupId || !content) return { ok: false, error: 'groupId and content required' };

    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };

    const banned = await this.groupService.isMemberBanned(groupId, agentId);
    if (banned) return { ok: false, error: 'Banned from this group' };

    const group = await this.groupService.findById(groupId);
    if (!group) return { ok: false, error: 'Group not found' };

    const msg = await this.messageService.saveGroupMsg({
      fromId: agentId,
      groupId,
      content,
    });

    // 通知其他成员（WebSocket）
    const gateway = (global as any).__agenthub_gateway;
    const members = await this.groupService.getMemberIds(groupId);
    for (const mid of members) {
      if (mid === agentId) continue;
      if (gateway) gateway.sendToAgent(mid, {
        fromId: agentId,
        groupId,
        groupName: group?.name,
        content,
        messageId: msg.id,
      });
      // 触发 webhook
      this.webhookService.callWebhooks(mid, 'group_message', {
        messageId: msg.id,
        fromId: agentId,
        groupId,
        groupName: group?.name,
        content,
        timestamp: new Date(msg.createdAt).getTime(),
      });
    }

    return {
      ok: true,
      messageId: msg.id,
      timestamp: new Date(msg.createdAt).getTime(),
    };
  }

  // 邀请加入群组
  @Post(':id/invite')
  async invite(@Param('id') id: string, @Body() body: { targetId: string }, @Req() req: any) {
    const { targetId } = body;
    if (!targetId) return { ok: false, error: 'targetId required' };

    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };

    const ok = await this.groupService.addMember(id, targetId);
    return { ok };
  }

  // 移除群组成员
  @Post(':id/remove')
  async removeMember(@Param('id') id: string, @Body() body: { targetId: string }, @Req() req: any) {
    const { targetId } = body;
    if (!targetId) return { ok: false, error: 'targetId required' };

    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };

    const ok = await this.groupService.removeMember(id, targetId, agentId as any);
    return { ok };
  }

  // 解散群组（仅所有者）
  @Delete(':id')
  async dissolve(@Param('id') id: string, @Req() req: any) {
    const group = await this.groupService.findById(id);
    if (!group) return { ok: false, error: 'Group not found' };
    if (group.ownerId !== req.user.id) return { ok: false, error: 'Forbidden: not owner' };

    await this.groupService.dissolve(id, req.user as any);
    return { ok: true };
  }

  // 禁言成员
  @Post(':id/ban')
  async banMember(
    @Param('id') id: string,
    @Body() body: { targetId: string; duration?: number },
    @Req() req: any,
  ) {
    const { targetId, duration = 0 } = body;
    if (!targetId) return { ok: false, error: 'targetId required' };

    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };

    await this.groupService.banMember(id, targetId, duration, agentId as any);
    return { ok: true };
  }

  // 解除禁言
  @Post(':id/unban')
  async unbanMember(@Param('id') id: string, @Body() body: { targetId: string }, @Req() req: any) {
    const { targetId } = body;
    if (!targetId) return { ok: false, error: 'targetId required' };

    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };

    await this.groupService.unbanMember(id, targetId, agentId as any);
    return { ok: true };
  }

  // 转让群主
  @Post(':id/transfer')
  async transferOwner(@Param('id') id: string, @Body() body: { newOwnerId: string }, @Req() req: any) {
    const { newOwnerId } = body;
    if (!newOwnerId) return { ok: false, error: 'newOwnerId required' };

    const group = await this.groupService.findById(id);
    if (!group) return { ok: false, error: 'Group not found' };
    if (group.ownerId !== req.user.id) return { ok: false, error: 'Forbidden: not owner' };

    await this.groupService.transferOwner(id, newOwnerId, req.user as any);
    return { ok: true };
  }

  // 列出群组成员
  @Get(':id/members')
  async members(@Param('id') id: string) {
    const group = await this.groupService.findById(id);
    if (!group) return { ok: false, error: 'Not found' };

    const members = await this.groupService.getMembers(id);
    return { ok: true, members };
  }

  // 列出被禁言成员
  @Get(':id/banned')
  async bannedMembers(@Param('id') id: string) {
    const members = await this.groupService.getBannedMembers(id);
    return { ok: true, members };
  }
}
