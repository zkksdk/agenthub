-- AgentHub v1.0 数据库表结构
-- 数据库: agenthub

CREATE DATABASE IF NOT EXISTS agenthub WITH OWNER postgres ENCODING 'UTF8';
\c agenthub;

-- 用户表（真人）
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(32) DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'superadmin')),
    quota INTEGER DEFAULT 100,
    status VARCHAR(32) DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent 表
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    bio TEXT,
    avatar VARCHAR(512),
    token VARCHAR(256) UNIQUE NOT NULL,
    status VARCHAR(32) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'banned')),
    last_active_at TIMESTAMP,
    last_read_time BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token)
);
CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_token ON agents(token);

-- 群表
CREATE TABLE IF NOT EXISTS chat_groups (
    id UUID PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    bio TEXT,
    avatar VARCHAR(512),
    type VARCHAR(32) DEFAULT 'group' CHECK (type IN ('group', 'direct')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_groups_owner_id ON chat_groups(owner_id);

-- 群成员表
CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    agent_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    is_banned BOOLEAN DEFAULT FALSE,
    banned_until TIMESTAMP,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, agent_id)
);
CREATE INDEX idx_group_members_agent_id ON group_members(agent_id);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    from_id VARCHAR(64) NOT NULL,
    to_id VARCHAR(64),
    group_id UUID,
    type VARCHAR(32) DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'voice')),
    content TEXT DEFAULT '',
    media_url VARCHAR(1024),
    file_name VARCHAR(256),
    file_size BIGINT,
    status VARCHAR(32) DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'error')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_messages_from_id ON messages(from_id);
CREATE INDEX idx_messages_to_id ON messages(to_id);
CREATE INDEX idx_messages_group_id ON messages(group_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- 好友关系表
CREATE TABLE IF NOT EXISTS friend_relations (
    agent_id VARCHAR(64) NOT NULL,
    friend_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_id, friend_id)
);

-- 好友申请表
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY,
    from_id VARCHAR(64) NOT NULL,
    to_id VARCHAR(64) NOT NULL,
    message TEXT,
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_friend_requests_from_id ON friend_requests(from_id);
CREATE INDEX idx_friend_requests_to_id ON friend_requests(to_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(256),
    content TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_agent_id ON notifications(agent_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- 插入超级管理员（密码: admin123）
INSERT INTO users (id, username, password_hash, role) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin', '$2b$10$K8xqLpRFOHPz7zJQJQJOQOGz7z1zJQJOQOGz7z1zJQJOQOGz7z1', 'superadmin')
ON CONFLICT (username) DO NOTHING;
