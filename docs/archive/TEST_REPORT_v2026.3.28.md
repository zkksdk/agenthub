# AgentHub 部署问题报告

> 来源：第三方测试（v2026.3.28）
> 记录时间：2026-04-01
> 状态：**已记录，待处理**

---

## 环境

- 系统：Ubuntu 24.04 (VM)
- Node.js：v22.22.2
- 包管理：npm 10.9.7

---

## 问题汇总

| # | 问题 | 严重程度 | 根因 |
|---|------|---------|------|
| 1 | GitHub 443 端口不可访问 | 🔴 高 | 网络限制 |
| 2 | bcrypt 编译失败 | 🟡 中 | native module 兼容问题 |
| 3 | better-sqlite3 编译失败 | 🟡 中 | node-gyp 构建目录问题 |
| 4 | Docker 部署失败 | 🟢 低 | 环境依赖缺失 |
| 5 | 前后端分离 404 | 🔴 高 | 部署文档不完整 |
| 6 | nginx 权限错误 | 🟡 中 | 路径权限配置 |

---

## 问题 1：GitHub 访问受限（443 端口超时）

**描述：** 服务器访问 GitHub HTTPS（443 端口）完全超时，无法 git clone 或下载 zip。

**排查：**
- `curl https://github.com` → 超时
- SSH 端口（22）可通：`ssh -T git@github.com` → 连接成功
- 多个国内镜像（fastgit、gh-proxy.com）→ 均 443 超时
- gh-proxy.com 域名可解析，但代理目标地址仍超时

**解决：** 使用 gh-proxy.com 代理下载：
```bash
curl -L -o /tmp/agenthub.zip "https://gh-proxy.com/https://github.com/zkksdk/agenthub/archive/refs/heads/main.zip"
```

**建议：**
- 提供更多镜像源
- 在 README 中列出国内可用下载方式（Gitee 同步镜像）
- 添加 gh-proxy.com 作为备选下载地址

---

## 问题 2：bcrypt 原生模块编译失败

**描述：** npm install 时 bcrypt 的 node-pre-gyp 报错，无法编译 native binding。

**日志：**
```
npm error node-pre-gyp ERR! cwd /root/agenthub/server/node_modules/bcrypt
npm error node-pre-gyp ERR! node -v v22.22.2
npm error node-pre-gyp ERR! node-pre-gyp -v v1.0.11
npm error not ok
```

**解决：** 改用 bcryptjs（纯 JS 实现，无需编译），手动替换：
```typescript
// 改动前
import * as bcrypt from 'bcrypt';
// 改动后
import * as bcrypt from 'bcryptjs';
```

**涉及文件：**
- `src/auth/auth.service.ts`
- `src/admin/admin.service.ts`

**建议：**
- 在 package.json 中将 bcrypt 改为 bcryptjs
- 或提供编译依赖说明（build-essential）

---

## 问题 3：better-sqlite3 原生模块编译失败

**描述：** make 报错"创建 .d.raw 依赖文件时目录不存在"。

**日志：**
```
Release/obj/gen/sqlite3/sqlite3.c:255953:1: fatal error:
  opening dependency file ./Release/.deps/.../sqlite3.o.d.raw: No such file or directory
```

**解决：** 删除 node_modules 重新 install，使用国内镜像：
```bash
npm install --registry https://registry.npmmirror.com
```

**建议：**
- 注明需要编译环境（build-essential、python3、node-gyp）
- 或提供预编译的二进制版本
- 考虑切换到 sql.js（纯 JS，零编译）

---

## 问题 4：Docker 环境问题

**描述：** 原计划 Docker 部署，遇到多个问题：
- Docker 未安装
- DNS 污染（docker.mirrors.ustc.edu.cn 被 systemd-resolved 解析到错误地址）
- iptables 缺失（Docker 启动失败）

**解决：** 放弃 Docker，改为手动 Node.js 部署。

**建议：**
- README 应注明 Docker 部署的前提条件：iptables/nftables、Docker daemon 已启动、正确的 DNS 配置

---

## 问题 5：前端与后端分离部署导致 404

**描述：** 前端（8080 端口）和后端（3000 端口）分开部署，前端调用 /api 时浏览器访问自身 8080 端口，返回 404。

**解决：** 用 nginx 做反向代理，统一走 80 端口：
```nginx
location / {
    root /var/www/html/agenthub;
    try_files $uri $uri/ /index.html;
}
location /api {
    proxy_pass http://127.0.0.1:3000;
}
location /ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**建议：**
- README 中说明反向代理配置
- 或提供一键 nginx 配置脚本

---

## 问题 6：nginx 读取静态文件权限不足

**描述：** 初始配置 `root /root/agenthub/web/agenthub-web/dist`，nginx 以 www-data 用户运行无权访问 /root/ 目录，返回 500。

**日志：**
```
[crit] stat() "/root/agenthub/.../index.html" failed (13: Permission denied)
```

**解决：** 将前端构建产物复制到 `/var/www/html/agenthub`（www-data 可读）。

**建议：**
- README 说明非 root 用户运行注意事项
- 或提供 `chmod +x` 建议

---

## 核心建议（按优先级）

### 🔴 必须修复
1. **bcrypt → bcryptjs**：消除 native module 编译问题，降低部署门槛
2. **添加 nginx 一键配置脚本**：解决前后端 404 问题
3. **在 README 中添加 gh-proxy.com 下载说明**：解决国内网络访问 GitHub 问题

### 🟡 应该修复
4. 考虑 better-sqlite3 → sql.js：彻底消除编译依赖
5. Docker 部署说明补充前提条件
6. 前端构建产物默认路径改为 /var/www/html/

### 🟢 可选优化
7. Gitee 同步镜像
8. 提供 docker-compose 非 root 运行模式说明

---

## 状态

- [x] 已记录
- [ ] 等待测试方发送完整原始报告
- [ ] 等待确认需修复优先级
- [ ] 待分配修复任务
