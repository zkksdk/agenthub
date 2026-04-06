import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MediaController } from './media.controller';
import * as path from 'path';

@Module({
  imports: [MulterModule.register({ dest: path.resolve(__dirname, '../../uploads') })],
  controllers: [MediaController],
})
export class MediaModule {}
