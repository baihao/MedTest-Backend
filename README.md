# MedTest-Backend

一个基于Node.js的医疗测试后端服务，提供用户管理、工作空间、实验室报告、OCR数据处理和WebSocket实时通信功能。

## 功能特性

- ✅ **用户认证**: JWT token认证系统
- ✅ **工作空间管理**: 多用户工作空间支持
- ✅ **实验室报告**: 完整的实验室报告CRUD操作
- ✅ **OCR数据处理**: 自动OCR数据上传和处理
- ✅ **WebSocket通信**: 实时通知和消息推送
- ✅ **任务调度**: 自动化OCR处理任务
- ✅ **健康监控**: 服务状态监控和健康检查

## 安装和启动

### 1. 安装依赖
```bash
npm install
```

### 2. 环境配置
创建 `.env` 文件：
```env
HTTP_SERVER_PORT=3000
SECRET_KEY=your-secret-key
OCR_PROCESSOR_DELAY=30000
OCR_PROCESSOR_BATCH_SIZE=5
AI_PROCESSOR_TIMEOUT=60000
WS_SERVER_HEARTBEAT_INTERVAL=60000
```

### 3. 启动服务
```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

## API文档（与实际实现完全一致）

---

### 1. 登录 API

#### POST `/login`
**请求体：**
```json
{
  "username": "alice",
  "password": "mypassword"
}
```
**正常返回：**
```json
{
  "username": "alice",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTY5ODg4ODg4OCwiZXhwIjoxNjk4ODkyNDg4fQ.abc123..."
}
```
**异常返回：**
- 400
  ```json
  { "error": "Username and password are required" }
  ```
- 401
  ```json
  { "error": "Invalid credentials" }
  ```

---

### 2. 工作空间 API

#### POST `/workspace/create`
**请求头：** `Authorization: Bearer <token>`
**请求体：**
```json
{ "name": "我的工作空间" }
```
**正常返回：**
```json
{
  "id": 1,
  "name": "我的工作空间",
  "userId": 1,
  "createdAt": "2024-07-24T12:00:00.000Z",
  "updatedAt": "2024-07-24T12:00:00.000Z"
}
```
**异常返回：**
- 400
  ```json
  { "error": "缺少必要参数: name" }
  ```

#### POST `/workspace/delete/{workspaceId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{workspaceId}` - 工作空间ID（数字）
**正常返回：**
```json
{ "id": 1 }
```
**异常返回：**
- 404
  ```json
  { "error": "未找到对应workspace" }
  ```
- 403
  ```json
  { "error": "无权删除此workspace" }
  ```

#### GET `/workspace/`
**请求头：** `Authorization: Bearer <token>`
**正常返回：**
```json
[
  {
    "id": 1,
    "name": "我的工作空间",
    "userId": 1,
    "createdAt": "2024-07-24T12:00:00.000Z",
    "updatedAt": "2024-07-24T12:00:00.000Z"
  }
]
```

#### GET `/workspace/{workspaceId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{workspaceId}` - 工作空间ID（数字）
**正常返回：**
```json
{
  "id": 1,
  "name": "我的工作空间",
  "userId": 1,
  "createdAt": "2024-07-24T12:00:00.000Z",
  "updatedAt": "2024-07-24T12:00:00.000Z"
}
```
**异常返回：**
- 404
  ```json
  { "error": "未找到对应workspace" }
  ```
- 403
  ```json
  { "error": "无权访问此workspace" }
  ```

---

### 3. 实验室报告 API

#### GET `/labreport/count/{workspaceId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{workspaceId}` - 工作空间ID（数字），获取该工作空间下的实验室报告总数
**正常返回：**
```json
{ "count": 2 }
```
**异常返回：**
- 404
  ```json
  { "error": "工作空间不存在" }
  ```
- 403
  ```json
  { "error": "无权访问此工作空间" }
  ```

#### GET `/labreport/workspace/{workspaceId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{workspaceId}` - 工作空间ID（数字），获取该工作空间下的所有实验室报告
**正常返回：**
```json
[
  {
    "id": 10,
    "patient": "张三",
    "reportTime": "2024-07-24T10:00:00.000Z",
    "doctor": "李医生",
    "reportImage": "img1.png",
    "hospital": "市医院",
    "workspaceId": 1,
    "ocrdataId": 201,
    "createdAt": "2024-07-24T10:01:00.000Z",
    "updatedAt": "2024-07-24T10:01:00.000Z"
  }
]
```
```

#### GET `/labreport/workspace/{workspaceId}/paginated?page=1&pageSize=2`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{workspaceId}` - 工作空间ID（数字），获取该工作空间下的实验室报告（分页）
**正常返回：**
```json
{
  "reports": [
    {
      "id": 10,
      "patient": "张三",
      "reportTime": "2024-07-24T10:00:00.000Z",
      "doctor": "李医生",
      "reportImage": "img1.png",
      "hospital": "市医院",
      "workspaceId": 1,
      "ocrdataId": 201,
      "createdAt": "2024-07-24T10:01:00.000Z",
      "updatedAt": "2024-07-24T10:01:00.000Z"
    }
  ],
```
  "pagination": {
    "currentPage": 1,
    "pageSize": 2,
    "totalCount": 2,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### GET `/labreport/{labReportId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{labReportId}` - 实验室报告ID（数字），获取单个实验室报告详情
**正常返回：**
```json
{
  "id": 10,
  "patient": "张三",
  "reportTime": "2024-07-24T10:00:00.000Z",
  "doctor": "李医生",
  "reportImage": "img1.png",
  "hospital": "市医院",
  "workspaceId": 1,
  "ocrdataId": 201,
  "createdAt": "2024-07-24T10:01:00.000Z",
  "updatedAt": "2024-07-24T10:01:00.000Z",
```
  "items": [
    {
      "id": 100,
      "labReportId": 10,
      "itemName": "白细胞计数",
      "result": "7.65",
      "unit": "10^9/L",
      "referenceValue": "3.5-9.5",
      "createdAt": "2024-07-24T10:01:00.000Z",
      "updatedAt": "2024-07-24T10:01:00.000Z"
    }
  ]
}
```
**异常返回：**
- 404
  ```json
  { "error": "检验报告不存在" }
  ```
- 403
  ```json
  { "error": "无权访问此检验报告" }
  ```

#### PUT `/labreport/{labReportId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{labReportId}` - 实验室报告ID（数字），更新实验室报告信息
**请求体：**
```json
{ "doctor": "王医生" }
```
**正常返回：**
```json
{
  "id": 10,
  "patient": "张三",
  "doctor": "王医生",
  "ocrdataId": 201,
  ...
}
```
```

#### DELETE `/labreport/{labReportId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{labReportId}` - 实验室报告ID（数字），删除实验室报告
**正常返回：**
```json
{ "id": 10, "message": "检验报告删除成功" }
```

#### POST `/labreport/search`
**请求头：** `Authorization: Bearer <token>`
**请求体：**
```json
{
  "workspaceId": 1,
  "patients": ["张三"],
  "itemNames": ["白细胞计数"],
  "startDate": "2024-07-01",
  "endDate": "2024-07-31",
  "page": 1,
  "pageSize": 10
}
```
**正常返回：**
```json
{
  "reports": [ ... ],
  "pagination": { ... }
}
```
**异常返回：**
- 400
  ```json
  { "error": "工作空间ID是必需的" }
  ```
  ```json
  { "error": "患者姓名列表是必需的且不能为空" }
  ```

#### POST `/labreport/`
**请求头：** `Authorization: Bearer <token>`
**请求体：**
```json
{
  "patient": "张三",
  "reportTime": "2024-07-24T10:00:00.000Z",
  "doctor": "李医生",
  "workspaceId": 1,
  "items": [
    {
      "itemName": "白细胞计数",
      "result": "7.65",
      "unit": "10^9/L",
      "referenceValue": "3.5-9.5"
    }
  ]
}
```
**正常返回：**
```json
{
  "id": 11,
  "patient": "张三",
  "reportTime": "2024-07-24T10:00:00.000Z",
  "doctor": "李医生",
  "workspaceId": 1,
  "ocrdataId": 202,
  "items": [ ... ]
}
```
```

#### POST `/labreport/workspace/{workspaceId}/by-ocrdata`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{workspaceId}` - 工作空间ID（数字），根据一组ocrdataId批量查询已处理的实验室报告
**请求体：**
```json
{
  "ocrdataIds": [201, 202, 203]
}
```
**正常返回：**
```json
[
  {
    "id": 10,
    "patient": "张三",
    "reportTime": "2024-07-24T10:00:00.000Z",
    "doctor": "李医生",
    "reportImage": "img1.png",
    "hospital": "市医院",
    "workspaceId": 1,
    "ocrdataId": 201,
    "createdAt": "2024-07-24T10:01:00.000Z",
    "updatedAt": "2024-07-24T10:01:00.000Z"
  },
  {
    "id": 11,
    "patient": "李四",
    "reportTime": "2024-07-24T11:00:00.000Z",
    "doctor": "王医生",
    "reportImage": "img2.png",
    "hospital": "省医院",
    "workspaceId": 1,
    "ocrdataId": 202,
    "createdAt": "2024-07-24T11:01:00.000Z",
    "updatedAt": "2024-07-24T11:01:00.000Z"
  }
]
```
**异常返回：**
- 400
  ```json
  { "error": "ocrdataIds参数是必需的且必须是数组" }
  ```
  ```json
  { "error": "ocrdataIds数组不能为空" }
  ```
- 404
  ```json
  { "error": "工作空间不存在" }
  ```
- 403
  ```json
  { "error": "无权访问此工作空间" }
  ```

---

### 4. 实验室报告项目 API

#### PUT `/labreportitem/{labReportItemId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{labReportItemId}` - 实验室报告项目ID（数字），更新实验室报告项目
**请求体：**
```json
{
  "itemName": "白细胞计数",
  "result": "8.00",
  "unit": "10^9/L",
  "referenceValue": "3.5-9.5"
}
```
**正常返回：**
```json
{
  "success": true,
  "message": "检验报告项目更新成功",
  "data": {
    "id": 100,
    "labReportId": 10,
    "itemName": "白细胞计数",
    "result": "8.00",
    "unit": "10^9/L",
    "referenceValue": "3.5-9.5",
    "updatedAt": "2024-07-24T10:10:00.000Z"
  }
}
```
**异常返回：**
- 400
  ```json
  { "success": false, "message": "检验报告项目ID必须是有效的数字" }
  ```
- 404
  ```json
  { "success": false, "message": "检验报告项目不存在" }
  ```
- 403
  ```json
  { "success": false, "message": "没有权限修改此检验报告项目" }
  ```

#### GET `/labreportitem/{labReportItemId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{labReportItemId}` - 实验室报告项目ID（数字），获取实验室报告项目详情
**正常返回：**
```json
{
  "success": true,
  "message": "获取检验报告项目成功",
  "data": {
    "id": 100,
    "labReportId": 10,
    "itemName": "白细胞计数",
    "result": "8.00",
    "unit": "10^9/L",
    "referenceValue": "3.5-9.5",
    "createdAt": "2024-07-24T10:01:00.000Z",
    "updatedAt": "2024-07-24T10:10:00.000Z"
  }
}
```

#### DELETE `/labreportitem/{labReportItemId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{labReportItemId}` - 实验室报告项目ID（数字），删除实验室报告项目
**正常返回：**
```json
{
  "success": true,
  "message": "检验报告项目删除成功",
  "data": { "id": 100 }
}
```

---

### 5. OCR数据 API

#### POST `/ocrdata/batch/{workspaceId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{workspaceId}` - 工作空间ID（数字），批量上传OCR数据到指定工作空间
**请求体：**
```json
{
  "ocrDataArray": [
    { "reportImage": "img1.png", "ocrPrimitive": "原始文本1" },
    { "reportImage": "img2.png", "ocrPrimitive": "原始文本2" }
  ]
}
```
**正常返回：**
```json
{
  "success": true,
  "message": "批量上传成功",
  "data": {
    "createdCount": 2,
    "workspaceId": 1,
    "workspaceName": "我的工作空间",
    "ocrData": [
      {
        "id": 201,
        "reportImage": "img1.png",
        "workspaceId": 1,
        "createdAt": "2024-07-24T10:20:00.000Z",
        "updatedAt": "2024-07-24T10:20:00.000Z"
      },
      {
        "id": 202,
        "reportImage": "img2.png",
        "workspaceId": 1,
        "createdAt": "2024-07-24T10:20:01.000Z",
        "updatedAt": "2024-07-24T10:20:01.000Z"
      }
    ]
  }
}
```
**异常返回：**
- 400
  ```json
  { "success": false, "message": "OCR数据数组不能为空" }
  ```
- 404
  ```json
  { "success": false, "message": "工作空间不存在" }
  ```
- 403
  ```json
  { "success": false, "message": "没有权限访问该工作空间" }
  ```

#### GET `/ocrdata/workspace/{workspaceId}?limit=2&offset=0`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{workspaceId}` - 工作空间ID（数字），获取指定工作空间的OCR数据列表
**正常返回：**
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "workspaceId": 1,
    "workspaceName": "我的工作空间",
    "totalCount": 2,
    "limit": 2,
    "offset": 0,
    "ocrData": [
      {
        "id": 201,
        "reportImage": "img1.png",
        "workspaceId": 1,
        "createdAt": "2024-07-24T10:20:00.000Z",
        "updatedAt": "2024-07-24T10:20:00.000Z"
      },
      {
        "id": 202,
        "reportImage": "img2.png",
        "workspaceId": 1,
        "createdAt": "2024-07-24T10:20:01.000Z",
        "updatedAt": "2024-07-24T10:20:01.000Z"
      }
    ]
  }
}
```

#### GET `/ocrdata/{ocrDataId}`
**请求头：** `Authorization: Bearer <token>`
**参数说明：** `{ocrDataId}` - OCR数据ID（数字），获取单个OCR数据详情
**正常返回：**
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "id": 201,
    "reportImage": "img1.png",
    "workspaceId": 1,
    "workspaceName": "我的工作空间",
    "createdAt": "2024-07-24T10:20:00.000Z",
    "updatedAt": "2024-07-24T10:20:00.000Z"
  }
}
```

#### DELETE `/ocrdata/batch`
**请求头：** `Authorization: Bearer <token>`
**请求体：**
```json
{ "idArray": [201, 202] }
```
**正常返回：**
```json
{
  "success": true,
  "message": "批量删除成功",
  "data": {
    "deletedCount": 2,
    "deletedIds": [201, 202]
  }
}
```

#### POST `/ocrdata/process`
**请求头：** `Authorization: Bearer <token>`
**请求体：**
```json
{ "batchSize": 50 }
```
**正常返回：**
```json
{
  "success": true,
  "message": "OCR处理已触发",
  "data": { "batchSize": 50 }
}
```

---

### 6. WebSocket API

#### 连接建立
**连接URL：** `ws://localhost:3000/ws?token=<jwt_token>`
**参数说明：** `token` - JWT认证令牌（必需）

**认证成功响应：**
```json
{
  "type": "auth_success",
  "sessionId": "session_1703123456789_abc123def",
  "userId": "1",
  "timestamp": "2024-07-24T10:30:00.000Z"
}
```

**认证失败响应：**
```json
{
  "type": "auth_failure",
  "message": "JWT token验证失败",
  "timestamp": "2024-07-24T10:30:00.000Z"
}
```

#### 客户端消息类型

##### 1. 心跳消息
**客户端发送：**
```json
{
  "type": "ping"
}
```
**服务器响应：**
```json
{
  "type": "pong",
  "timestamp": "2024-07-24T10:30:00.000Z"
}
```

##### 2. 回显消息
**客户端发送：**
```json
{
  "type": "echo",
  "data": {
    "message": "Hello WebSocket"
  }
}
```
**服务器响应：**
```json
{
  "type": "echo_response",
  "data": {
    "message": "Hello WebSocket"
  },
  "timestamp": "2024-07-24T10:30:00.000Z"
}
```

#### 服务器推送消息类型

##### 1. 实验室报告创建通知
**服务器推送：**
```json
{
  "type": "labReportCreated",
  "labReportId": 10,
  "ocrDataId": 201,
  "timestamp": "2024-07-24T10:30:00.000Z"
}
```

##### 2. 会话关闭通知
**服务器推送：**
```json
{
  "type": "session_closed",
  "reason": "User session closed",
  "timestamp": "2024-07-24T10:30:00.000Z"
}
```

##### 3. 错误消息
**服务器推送：**
```json
{
  "type": "error",
  "message": "消息格式错误",
  "timestamp": "2024-07-24T10:30:00.000Z"
}
```

#### 服务器方法 API

##### 1. 获取服务器状态
**GET** `/health/test`
**正常返回：**
```json
{
  "status": "ok",
  "scheduler": {
    "isRunning": true,
    "lastRunTime": "2024-07-24T10:00:00.000Z",
    "nextRunTime": "2024-07-24T10:30:00.000Z",
    "taskCount": 5
  },
  "ocrProcessor": {
    "isProcessing": false,
    "lastProcessTime": "2024-07-24T10:00:00.000Z",
    "processedCount": 10
  },
  "wsServer": {
    "exists": true,
    "activeConnections": 3
  }
}
```

#### WebSocket服务器内部方法

##### 1. 向用户发送消息
```javascript
// 服务器端调用
wsServer.sendMsgToUser(userId, message)
```
**参数说明：**
- `userId` - 用户ID（字符串）
- `message` - 消息对象

**返回：** `boolean` - 是否发送成功

##### 2. 关闭用户会话
```javascript
// 服务器端调用
wsServer.closeUserSessions(userId, code, reason)
```
**参数说明：**
- `userId` - 用户ID（字符串）
- `code` - 关闭代码（可选，默认1000）
- `reason` - 关闭原因（可选，默认'User session closed'）

**返回：** `number` - 关闭的会话数量

##### 3. 获取服务器状态
```javascript
// 服务器端调用
wsServer.getStatus()
```
**返回：**
```json
{
  "totalConnections": 3,
  "totalUsers": 2,
  "activeSessions": ["session_1", "session_2", "session_3"],
  "userSessions": {
    "1": ["session_1", "session_2"],
    "2": ["session_3"]
  }
}
```

##### 4. 获取用户会话信息
```javascript
// 服务器端调用
wsServer.getUserSessions(userId)
```
**参数说明：** `userId` - 用户ID（字符串）

**返回：**
```json
[
  {
    "sessionId": "session_1703123456789_abc123def",
    "userId": "1",
    "connectedAt": "2024-07-24T10:30:00.000Z",
    "lastActivity": "2024-07-24T10:35:00.000Z",
    "ipAddress": "127.0.0.1",
    "userAgent": "Mozilla/5.0..."
  }
]
```

#### 连接管理

##### 会话信息结构
```json
{
  "sessionId": "session_1703123456789_abc123def",
  "userId": "1",
  "connectedAt": "2024-07-24T10:30:00.000Z",
  "lastActivity": "2024-07-24T10:35:00.000Z",
  "ipAddress": "127.0.0.1",
  "userAgent": "Mozilla/5.0..."
}
```

##### 多连接支持
- 同一用户可以建立多个WebSocket连接
- 服务器自动管理用户的所有会话
- 发送消息时会发送到用户的所有活跃连接

##### 心跳机制
- 服务器每60秒发送一次ping帧
- 客户端应响应pong帧
- 超时未活跃的连接会被自动关闭（超时时间为120秒）

#### 错误处理

##### 连接错误
- **缺少JWT token**: 返回认证失败消息并关闭连接
- **无效JWT token**: 返回认证失败消息并关闭连接
- **JWT token过期**: 返回认证失败消息并关闭连接
- **用户不存在**: 返回认证失败消息并关闭连接

##### 消息错误
- **无效JSON格式**: 返回错误消息
- **未知消息类型**: 记录警告日志，忽略消息

---

（如需 WebSocket API 或其它接口实例，请补充说明）

## 错误处理

### 通用错误响应格式

```json
{
    "error": "错误描述",
    "details": "详细错误信息（可选）",
    "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### 常见HTTP状态码

- **200 OK**: 请求成功
- **201 Created**: 资源创建成功
- **400 Bad Request**: 请求参数错误
- **401 Unauthorized**: 认证失败
- **403 Forbidden**: 权限不足
- **404 Not Found**: 资源不存在
- **500 Internal Server Error**: 服务器内部错误

---

## 测试

### 运行所有测试
```bash
npm test
```

### 运行特定测试
```bash
# WebSocket测试
npm test -- tests/wsServer.test.js

# 端到端测试
npm test -- tests/workflowE2E.test.js

# 实验室报告测试
npm test -- tests/labreport.test.js
```

### 测试覆盖率
```bash
npm run test:coverage
```

---

## 部署

### 生产环境配置
```env
NODE_ENV=production
HTTP_SERVER_PORT=3000
SECRET_KEY=your-production-secret-key
DATABASE_URL=your-production-database-url
```

### Docker部署
```bash
# 构建镜像
docker build -t medtest-backend .

# 运行容器
docker run -p 3000:3000 medtest-backend
```

---

## 监控和日志

### 日志级别
- **INFO**: 一般信息
- **WARN**: 警告信息
- **ERROR**: 错误信息
- **DEBUG**: 调试信息

### 健康检查
定期检查 `/health/test` 端点以监控服务状态。

---

## 注意事项

1. **JWT密钥**: 生产环境请使用强密钥
2. **数据库连接**: 确保数据库连接池配置合理
3. **文件上传**: 注意文件大小限制
4. **WebSocket连接**: 考虑连接数量限制
5. **错误处理**: 所有API都有完善的错误处理机制 