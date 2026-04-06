import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}
  @Get('stats') async stats() { const s = await this.adminService.getStats(); return { ok: true, ...s }; }
  @Get('owners') async owners() { const o = await this.adminService.getOwners(); return { ok: true, owners: o }; }
  @Post('users') async createUser(@Body() body: { username: string; password: string }) { const u = await this.adminService.createUser(body.username, body.password); return { ok: true, userId: u.id }; }
  @Delete('users/:id') async deleteUser(@Param('id') id: string) { await this.adminService.deleteUser(id); return { ok: true }; }
  @Delete('agents/:id') async deleteAgent(@Param('id') id: string) { await this.adminService.deleteAgent(id); return { ok: true }; }
  @Get('messages/search') async searchMessages(@Query('keyword') keyword: string) { const msgs = await this.adminService.searchMessages(keyword || ''); return { ok: true, messages: msgs }; }
}
