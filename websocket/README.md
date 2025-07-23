# WebSocket服务器

这是一个基于JWT认证的WebSocket服务器，提供实时通信功能。

## 功能特性

- ✅ **JWT认证**: 使用JWT token进行用户认证
- ✅ **会话管理**: 自动管理用户连接会话
- ✅ **多连接支持**: 支持同一用户的多个连接
- ✅ **消息发送**: 支持向指定用户发送消息
- ✅ **状态监控**: 提供服务器状态和用户会话信息
- ✅ **错误处理**: 完善的错误处理和日志记录

## 安装依赖

```bash
npm install ws jsonwebtoken
```

## 基本使用

### 1. 创建WebSocket服务器

```javascript
const http = require('http');
const WebSocketServer = require('./websocket/wsServer');

// 创建HTTP服务器
const server = http.createServer();

// 创建WebSocket服务器
const wsServer = new WebSocketServer(server, {
    jwtSecret: 'your-jwt-secret-key',
    port: 8080
});

// 启动服务器
server.listen(8080, () => {
    console.log('WebSocket服务器运行在端口 8080');
});
```

### 2. 客户端连接

```javascript
// 生成JWT token
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 'user123' }, 'your-jwt-secret-key');

// 建立WebSocket连接
const WebSocket = require('ws');
const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

ws.on('open', () => {
    console.log('连接已建立');
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('收到消息:', message);
});

ws.on('close', () => {
    console.log('连接已关闭');
});
```

## API文档

### WebSocketServer类

#### 构造函数

```javascript
new WebSocketServer(server, options)
```

**参数:**
- `server`: HTTP服务器实例
- `options`: 配置选项
  - `jwtSecret`: JWT密钥 (默认: process.env.JWT_SECRET)
  - `port`: 端口号 (默认: 8080)

#### 方法

##### sendMsgToUser(userId, message)

向指定用户发送消息。

```javascript
const result = wsServer.sendMsgToUser('user123', {
    type: 'notification',
    content: '您有一条新消息',
    timestamp: new Date().toISOString()
});

if (result) {
    console.log('消息发送成功');
} else {
    console.log('用户没有活跃连接');
}
```

##### closeUserSessions(userId, code, reason)

关闭指定用户的所有会话。

```javascript
const closedSessions = wsServer.closeUserSessions('user123', 1000, 'User session closed');
console.log('关闭的会话数量:', closedSessions);
```

##### getStatus()

获取服务器状态信息。

```javascript
const status = wsServer.getStatus();
console.log('总连接数:', status.totalConnections);
console.log('总用户数:', status.totalUsers);
console.log('活跃会话:', status.activeSessions);
console.log('用户会话:', status.userSessions);
```

##### getUserSessions(userId)

获取指定用户的会话信息。

```javascript
const sessions = wsServer.getUserSessions('user123');
console.log('用户会话:', sessions);
```

##### close()

关闭WebSocket服务器。

```javascript
wsServer.close();
```

## 消息格式

### 认证消息

#### 认证成功
```json
{
    "type": "auth_success",
    "sessionId": "session_1234567890_abc123",
    "userId": "user123",
    "timestamp": "2023-01-01T00:00:00.000Z"
}
```

#### 认证失败
```json
{
    "type": "auth_failure",
    "message": "JWT token验证失败",
    "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### 内置消息类型

#### Ping/Pong
```javascript
// 客户端发送
{ "type": "ping" }

// 服务器响应
{ "type": "pong", "timestamp": "2023-01-01T00:00:00.000Z" }
```

#### Echo
```javascript
// 客户端发送
{ "type": "echo", "data": { "message": "Hello" } }

// 服务器响应
{ 
    "type": "echo_response", 
    "data": { "message": "Hello" },
    "timestamp": "2023-01-01T00:00:00.000Z"
}
```

#### 错误消息
```json
{
    "type": "error",
    "message": "消息格式错误",
    "timestamp": "2023-01-01T00:00:00.000Z"
}
```

## 会话管理

### 会话信息结构

```javascript
{
    sessionId: "session_1234567890_abc123",
    userId: "user123",
    connectedAt: "2023-01-01T00:00:00.000Z",
    lastActivity: "2023-01-01T00:00:00.000Z",
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0..."
}
```

### 多连接支持

同一用户可以建立多个WebSocket连接，服务器会自动管理：

```javascript
// 用户user123可以同时建立多个连接
const ws1 = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
const ws2 = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
const ws3 = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

// 发送消息时会发送到所有连接
wsServer.sendMsgToUser('user123', { type: 'broadcast', message: 'Hello' });
```

## 错误处理

### 连接错误

- **缺少JWT token**: 返回认证失败消息并关闭连接
- **无效JWT token**: 返回认证失败消息并关闭连接
- **JWT token过期**: 返回认证失败消息并关闭连接
- **缺少用户ID**: 返回认证失败消息并关闭连接

### 消息错误

- **无效JSON**: 返回错误消息
- **未知消息类型**: 记录警告日志

## 测试

运行测试：

```bash
npm test -- tests/wsServer.test.js
```

测试覆盖：
- JWT认证测试
- 会话管理测试
- 消息发送测试
- 消息处理测试
- 服务器状态测试

## 示例

查看 `example.js` 文件获取完整的使用示例。

## 注意事项

1. **JWT密钥**: 请使用强密钥，不要在生产环境中使用默认密钥
2. **连接限制**: 考虑添加连接数量限制以防止资源耗尽
3. **心跳机制**: 建议实现客户端心跳机制以检测断开的连接
4. **错误日志**: 服务器会记录详细的错误日志，便于调试
5. **优雅关闭**: 使用 `close()` 方法优雅关闭服务器 