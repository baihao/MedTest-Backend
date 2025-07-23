# LabReportItem API 文档

LabReportItem API 提供了对检验报告项目的管理功能，包括获取、更新和删除检验报告项目。

## 基础信息

- **基础路径**: `/labreportitem`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

## API 端点

### 1. 获取单个检验报告项目

**GET** `/labreportitem/:id`

获取指定ID的检验报告项目详情。

#### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | number | 是 | 检验报告项目ID |

#### 请求头

```
Authorization: Bearer <jwt_token>
```

#### 响应格式

**成功响应 (200)**

```json
{
  "success": true,
  "message": "获取检验报告项目成功",
  "data": {
    "id": 1,
    "labReportId": 1,
    "itemName": "白细胞计数",
    "result": "7.65",
    "unit": "10^9/L",
    "referenceValue": "3.5-9.5",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**错误响应**

- `400` - 无效的ID格式
- `401` - 未提供认证token
- `403` - 没有权限访问此检验报告项目
- `404` - 检验报告项目不存在

### 2. 更新检验报告项目

**PUT** `/labreportitem/:id`

更新指定ID的检验报告项目。

#### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | number | 是 | 检验报告项目ID |

#### 请求体

```json
{
  "itemName": "白细胞计数",
  "result": "7.65",
  "unit": "10^9/L",
  "referenceValue": "3.5-9.5"
}
```

**字段说明**

| 字段 | 类型 | 必填 | 描述 | 长度限制 |
|------|------|------|------|----------|
| itemName | string | 否 | 项目名称 | 1-200字符 |
| result | string | 否 | 检验结果 | 1-500字符 |
| unit | string | 否 | 单位 | 0-50字符 |
| referenceValue | string | 否 | 参考值 | 0-200字符 |

#### 请求头

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### 响应格式

**成功响应 (200)**

```json
{
  "success": true,
  "message": "检验报告项目更新成功",
  "data": {
    "id": 1,
    "labReportId": 1,
    "itemName": "白细胞计数",
    "result": "7.65",
    "unit": "10^9/L",
    "referenceValue": "3.5-9.5",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**错误响应**

- `400` - 无效的ID格式或数据验证失败
- `401` - 未提供认证token
- `403` - 没有权限修改此检验报告项目
- `404` - 检验报告项目不存在
- `500` - 更新失败

### 3. 删除检验报告项目

**DELETE** `/labreportitem/:id`

删除指定ID的检验报告项目。

#### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | number | 是 | 检验报告项目ID |

#### 请求头

```
Authorization: Bearer <jwt_token>
```

#### 响应格式

**成功响应 (200)**

```json
{
  "success": true,
  "message": "检验报告项目删除成功",
  "data": {
    "id": 1
  }
}
```

**错误响应**

- `400` - 无效的ID格式
- `401` - 未提供认证token
- `403` - 没有权限删除此检验报告项目
- `404` - 检验报告项目不存在
- `500` - 删除失败

## 权限控制

所有API端点都需要JWT认证，并且用户只能操作属于自己工作空间的检验报告项目。

权限验证流程：
1. 验证JWT token有效性
2. 获取检验报告项目
3. 通过检验报告项目获取关联的检验报告
4. 通过检验报告获取工作空间
5. 验证工作空间是否属于当前用户

## 错误处理

所有API都遵循统一的错误响应格式：

```json
{
  "success": false,
  "message": "错误描述信息"
}
```

常见错误码：
- `400` - 请求参数错误
- `401` - 认证失败
- `403` - 权限不足
- `404` - 资源不存在
- `500` - 服务器内部错误

## 使用示例

### JavaScript (axios)

```javascript
const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000';
const TOKEN = 'your_jwt_token';

// 获取检验报告项目
async function getLabReportItem(id) {
    const response = await axios.get(`${BASE_URL}/labreportitem/${id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
    });
    return response.data.data;
}

// 更新检验报告项目
async function updateLabReportItem(id, updateData) {
    const response = await axios.put(`${BASE_URL}/labreportitem/${id}`, updateData, {
        headers: { 
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data.data;
}

// 删除检验报告项目
async function deleteLabReportItem(id) {
    const response = await axios.delete(`${BASE_URL}/labreportitem/${id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
    });
    return response.data;
}
```

### cURL

```bash
# 获取检验报告项目
curl -X GET "http://localhost:3000/labreportitem/1" \
  -H "Authorization: Bearer your_jwt_token"

# 更新检验报告项目
curl -X PUT "http://localhost:3000/labreportitem/1" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "result": "异常",
    "unit": "mg/dL"
  }'

# 删除检验报告项目
curl -X DELETE "http://localhost:3000/labreportitem/1" \
  -H "Authorization: Bearer your_jwt_token"
```

## 数据模型

### LabReportItem 字段说明

| 字段 | 类型 | 描述 | 约束 |
|------|------|------|------|
| id | number | 主键ID | 自增 |
| labReportId | number | 关联的检验报告ID | 外键 |
| itemName | string | 项目名称 | 1-200字符，必填 |
| result | string | 检验结果 | 1-500字符，必填 |
| unit | string | 单位 | 0-50字符，可选 |
| referenceValue | string | 参考值 | 0-200字符，可选 |
| createdAt | string | 创建时间 | ISO 8601格式 |
| updatedAt | string | 更新时间 | ISO 8601格式 |

## 注意事项

1. **权限验证**: 用户只能操作属于自己工作空间的检验报告项目
2. **数据验证**: 所有输入数据都会进行格式和长度验证
3. **级联删除**: 删除检验报告时会自动删除相关的检验报告项目
4. **事务处理**: 更新操作使用数据库事务确保数据一致性
5. **日志记录**: 所有操作都会记录详细的访问日志 