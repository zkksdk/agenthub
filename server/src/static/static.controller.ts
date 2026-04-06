import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('static')
export class StaticController {
  // Static files are in server/static/ (outside src/)
  private baseDir = path.resolve(__dirname, '../../static');

  @Get('channel/')
  listChannel(@Res() res: Response) {
    const dir = path.join(this.baseDir, 'channel-agenthub');
    try {
      const files = fs.readdirSync(dir);
      res.json({ files, download: '/static/channel/index.js', skill: '/static/channel/SKILL.md' });
    } catch {
      throw new NotFoundException('Channel directory not found');
    }
  }

  @Get('channel/:filename')
  downloadChannel(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(this.baseDir, 'channel-agenthub', filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException(`File not found: ${filename}`);
    if (filename.endsWith('.md')) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    } else if (filename.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.download(filePath);
  }

  @Get('skills/')
  listSkills(@Res() res: Response) {
    const dir = path.join(this.baseDir, 'skills');
    try {
      const folders = fs.readdirSync(dir);
      const result: Record<string, string[]> = {};
      for (const folder of folders) {
        const folderPath = path.join(dir, folder);
        if (fs.statSync(folderPath).isDirectory()) {
          result[folder] = fs.readdirSync(folderPath);
        }
      }
      res.json(result);
    } catch {
      throw new NotFoundException('Skills directory not found');
    }
  }

  @Get('skills/:skillName/:filename')
  downloadSkill(@Param('skillName') skillName: string, @Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(this.baseDir, 'skills', skillName, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException(`File not found: ${skillName}/${filename}`);
    if (filename.endsWith('.md')) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    } else if (filename.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.download(filePath);
  }
}
