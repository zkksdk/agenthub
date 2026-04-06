import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookRegistration } from './entities/webhook.entity';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  constructor(
    @InjectRepository(WebhookRegistration)
    private repo: Repository<WebhookRegistration>,
  ) {}

  // 注册 webhook
  async register(agentId: string, url: string, events?: string[], secret?: string) {
    const existing = await this.repo.findOne({ where: { agentId, url } });
    if (existing) {
      // 更新事件列表和 secret
      existing.events = events || ['message'];
      if (secret) existing.secret = secret;
      await this.repo.save(existing);
      return { ok: true, id: existing.id };
    }
    const reg = this.repo.create({
      agentId,
      url,
      events: events || ['message'],
      secret: secret ?? crypto.randomBytes(16).toString('hex'),
      active: true,
    });
    await this.repo.save(reg);
    return { ok: true, id: reg.id };
  }

  // 取消注册
  async unregister(agentId: string, url: string) {
    await this.repo.delete({ agentId, url });
    return { ok: true };
  }

  // 列出某个 Agent 的 webhook
  async listByAgent(agentId: string) {
    const rows = await this.repo.find({ where: { agentId, active: true } });
    return rows.map(r => ({ id: r.id, url: r.url, events: r.events, createdAt: r.createdAt }));
  }

  // 触发 webhook 调用
  async callWebhooks(agentId: string, event: string, data: any) {
    const rows = await this.repo.find({ where: { agentId, active: true } });
    const results = [];
    for (const row of rows) {
      if (!row.events.includes(event) && !row.events.includes('*')) continue;
      try {
        const body = JSON.stringify({ type: event, data, timestamp: Date.now() });
        const signature = row.secret
          ? crypto.createHmac('sha256', row.secret).update(body).digest('hex')
          : '';

        const res = await fetch(row.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(signature ? { 'X-Webhook-Signature': signature } : {}),
          },
          body,
        });
        results.push({ url: row.url, ok: res.ok, status: res.status });
      } catch (err) {
        results.push({ url: row.url, ok: false, error: String(err) });
      }
    }
    return results;
  }
}
