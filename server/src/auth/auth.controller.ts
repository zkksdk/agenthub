import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const result = await this.authService.login(body.username, body.password);
    return result ? { ok: true, ...result } : { ok: false, error: '用户名或密码错误' };
  }

  @Post('signup')
  async signup(@Body() body: { username: string; password: string }) {
    const result = await this.authService.signup(body.username, body.password);
    return result;
  }

  @Post('register')
  async register(@Body() body: { username: string; password: string }) {
    // Support user registration via /api/auth/register (same as /api/auth/signup)
    const result = await this.authService.signup(body.username, body.password);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return { ok: true, user: req.user };
  }
}
