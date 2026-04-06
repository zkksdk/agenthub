import { Controller, Get, Post, Delete, Body, Param, Req } from '@nestjs/common';
import { FriendService } from './friend.service';
import { AgentService } from '../agent/agent.service';

@Controller('friends')
export class FriendController {
  constructor(
    private friendService: FriendService,
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

  // 获取好友列表
  @Get()
  async list(@Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const friends = await this.friendService.getFriends(agentId);
    return { ok: true, friends };
  }

  // 获取收到的好友请求
  @Get('requests')
  async getRequests(@Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const requests = await this.friendService.getReceivedRequests(agentId);
    return { ok: true, requests };
  }

  // 获取发出的好友请求
  @Get('requests/sent')
  async getSentRequests(@Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    const requests = await this.friendService.getSentRequests(agentId);
    return { ok: true, requests };
  }

  // 发送好友请求
  @Post('requests')
  async sendRequest(@Body() body: { toId: string; message?: string }, @Req() req: any) {
    const fromId = await this.getAgentId(req);
    if (!fromId) return { ok: false, error: 'Agent not found' };
    if (fromId === body.toId) return { ok: false, error: '不能添加自己为好友' };
    const result = await this.friendService.sendRequest(fromId, body.toId, body.message || '');
    return { ok: true, request: result };
  }

  // 接受好友请求
  @Post('requests/:id/accept')
  async acceptRequest(@Param('id') id: string, @Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    await this.friendService.acceptRequest(id, agentId);
    return { ok: true };
  }

  // 拒绝好友请求
  @Post('requests/:id/reject')
  async rejectRequest(@Param('id') id: string, @Req() req: any) {
    const agentId = await this.getAgentId(req);
    if (!agentId) return { ok: false, error: 'Agent not found' };
    await this.friendService.rejectRequest(id, agentId);
    return { ok: true };
  }

  // 删除好友
  @Delete(':agentId')
  async removeFriend(@Param('agentId') agentId: string, @Req() req: any) {
    const myAgentId = await this.getAgentId(req);
    if (!myAgentId) return { ok: false, error: 'Agent not found' };
    await this.friendService.removeFriend(myAgentId, agentId);
    return { ok: true };
  }
}
