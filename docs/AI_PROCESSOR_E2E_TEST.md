# AiProcessor E2E 测试文档

## 概述

`tests/aiProcessorE2E.test.js` 是 `aiProcessor.js` 的端到端测试文件，专门用于测试从 OCR 数据中提取 `workspaceId` 的功能。

## 测试目标

1. **workspaceId 提取验证**: 确保从 OCR 数据中正确提取 `workspaceId` 字段
2. **数据结构验证**: 验证生成的 LabReport 实例包含所有必需字段
3. **错误处理**: 测试各种异常情况的处理
4. **API 集成**: 测试与 Alibaba Cloud DeepSeek 模型的集成

## 测试数据

测试使用 `data/ocrdata.json` 中的测试数据：

- **记录1**: workspaceId = 1 (牛霞的全血细胞计数报告)
- **记录2**: workspaceId = 1 (张三的生化检验报告)  
- **记录3**: workspaceId = 2 (李四的尿常规检验报告)

## 测试用例

### 1. workspaceId 提取测试

#### 1.1 单个 OCR 数据提取
- **输入**: 包含 workspaceId = 1 的单个 OCR 数据
- **预期**: 生成的 LabReport 实例中 workspaceId = 1
- **验证**: 检查返回结果的 workspaceId 字段值

#### 1.2 多个 OCR 数据提取
- **输入**: 包含多个 OCR 数据的数组 [workspaceId: 1, 1, 2]
- **预期**: 生成的 LabReport 实例数组，每个实例包含正确的 workspaceId
- **验证**: 逐个检查每个 LabReport 的 workspaceId 值

#### 1.3 空数据列表处理
- **输入**: 空的 OCR 数据数组
- **预期**: 返回空数组
- **验证**: 确保不会抛出异常

### 2. 数据结构验证测试

#### 2.1 LabReport 结构验证
- **验证字段**: patient, reportTime, reportImage, items, workspaceId
- **类型检查**: workspaceId 必须是数字类型
- **数组验证**: items 必须是数组

#### 2.2 LabReportItem 结构验证
- **必需字段**: itemName, result
- **可选字段**: unit, referenceValue

### 3. 错误处理测试

#### 3.1 无效 JSON 输入
- **输入**: 无效的 JSON 字符串
- **预期**: 抛出 "OCR数据JSON解析失败" 错误

#### 3.2 非数组输入
- **输入**: 非数组格式的 JSON
- **预期**: 抛出 "OCR数据必须是数组格式" 错误

#### 3.3 无效 AI 响应
- **输入**: 无效的 AI 模型响应
- **预期**: 抛出 "解析AI响应失败" 错误

### 4. 提示词构建测试

#### 4.1 workspaceId 提取指令
- **验证**: 提示词包含 "workspaceId: Extract from ocrdata's workspaceId"
- **验证**: 提示词包含 "ocrdataId: Extract from ocrdata's id"

### 5. 响应解析测试

#### 5.1 有效响应解析
- **输入**: 包含 workspaceId 的有效 JSON 响应
- **预期**: 正确解析并返回 LabReport 实例

#### 5.2 Markdown 代码块处理
- **输入**: 包含 ```json 标记的响应
- **预期**: 正确移除标记并解析 JSON

## 运行测试

### 环境配置

#### 1. 创建 .env 文件
在项目根目录创建 `.env` 文件：

```bash
# 复制示例文件
cp .env.example .env
```

#### 2. 配置 API Key
编辑 `.env` 文件，设置您的 DashScope API Key：

```env
# Alibaba Cloud DashScope API Configuration
DASHSCOPE_API_KEY=your_actual_dashscope_api_key_here

# 其他配置...
DB_HOST=localhost
DB_PORT=3306
DB_NAME=medtest
DB_USER=root
DB_PASSWORD=

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

#### 3. 获取 DashScope API Key
1. 访问 [Alibaba Cloud DashScope](https://dashscope.aliyun.com/)
2. 注册/登录账户
3. 创建 API Key
4. 将 API Key 复制到 `.env` 文件中

### 运行方式

#### 完整测试（需要 API Key）
```bash
# 确保 .env 文件中有正确的 API Key
npm test -- tests/aiProcessorE2E.test.js --verbose
```

#### 本地逻辑测试（不需要 API Key）
```bash
# 即使没有 API Key，也能测试本地逻辑
npm test -- tests/aiProcessorE2E.test.js --testNamePattern="Response Parsing|LabReport Validation|Prompt Building"
```

#### 使用测试脚本
```bash
# 使用测试脚本
node scripts/runAiProcessorE2ETest.js
```

### 测试模式

#### 1. 完整模式（有 API Key）
- ✅ 测试所有功能，包括真实的 AI 模型调用
- ✅ 验证完整的端到端流程
- ✅ 测试 workspaceId 提取的准确性

#### 2. 本地模式（无 API Key）
- ✅ 测试本地逻辑和错误处理
- ✅ 测试 JSON 解析和验证
- ✅ 测试提示词构建
- ⚠️ 跳过需要 API 调用的测试

## 测试结果验证

### 成功标准

1. **workspaceId 提取正确**: 所有生成的 LabReport 实例都包含正确的 workspaceId
2. **数据结构完整**: 所有必需字段都存在且类型正确
3. **错误处理有效**: 异常情况能够正确抛出错误
4. **API 集成正常**: 能够成功调用 AI 模型并解析响应

### 失败处理

1. **API 调用失败**: 测试会跳过相关用例，继续运行其他测试
2. **数据格式错误**: 会抛出相应的错误信息
3. **网络问题**: 会记录错误日志并跳过测试

## 注意事项

### API Key 安全
- **不要**在测试代码中硬编码 API Key
- **不要**将 `.env` 文件提交到版本控制
- **使用** `.env.example` 作为模板
- **确保** `.env` 在 `.gitignore` 中

### 测试设计原则
1. **不依赖外部服务**: 测试应该能够在不连接外部 API 的情况下运行
2. **优雅降级**: 当 API 不可用时，测试应该跳过相关部分而不是失败
3. **真实环境**: 当有 API Key 时，测试真实的端到端流程

### 成本控制
1. **API 限制**: 注意 Alibaba Cloud DashScope API 的调用频率限制
2. **测试频率**: 避免频繁运行完整测试以减少 API 调用成本
3. **本地优先**: 优先运行本地逻辑测试

## 扩展测试

可以根据需要添加更多测试用例：

1. **不同医院格式**: 测试不同医院的报告格式
2. **边界情况**: 测试极端的数据情况
3. **性能测试**: 测试大量数据的处理性能
4. **并发测试**: 测试并发处理能力

## 故障排除

### 常见问题

#### 1. API Key 错误
```
Error: 401 Incorrect API key provided.
```
**解决方案**: 检查 `.env` 文件中的 `DASHSCOPE_API_KEY` 是否正确

#### 2. 网络连接问题
```
Error: Network timeout
```
**解决方案**: 检查网络连接，确保能够访问 DashScope API

#### 3. 模型不可用
```
Error: Model not found
```
**解决方案**: 检查模型名称是否正确（当前使用 `deepseek-v3`）

### 调试技巧

1. **查看详细日志**: 使用 `--verbose` 参数
2. **运行单个测试**: 使用 `--testNamePattern` 参数
3. **检查环境变量**: 确认 `.env` 文件被正确加载
4. **API 状态检查**: 使用 `getStatus()` 方法检查配置状态 