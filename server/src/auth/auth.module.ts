import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../user/entities/user.entity';
import { Agent } from '../agent/entities/agent.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Agent]),
    PassportModule,
    JwtModule.register({ secret: process.env.JWT_SECRET || 'agenthub-secret-2026', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
