import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, Res, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('media')
export class MediaController {
  // 上传目录：相对于 server/ 目录
  private uploadDir = path.resolve(__dirname, '../../uploads');

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    dest: path.resolve(__dirname, '../../uploads'),
  }))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { ok: false, error: 'No file' };
    return {
      ok: true,
      url: '/api/media/' + file.filename,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  @Get(':filename')
  serve(@Param('filename') filename: string, @Res() res: Response) {
    // 禁止路径穿越攻击
    const safeName = path.basename(filename);
    const filePath = path.join(this.uploadDir, safeName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');
    res.sendFile(filePath);
  }
}
