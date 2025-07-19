# AI Processor 文档

## 概述

`AiProcessor` 是一个用于处理OCR数据并生成结构化LabReport实例的AI处理器。它使用DeepSeek R1模型通过Alibaba Cloud DashScope API来解析医疗检验报告的OCR数据。

## 功能特性

- 解析OCR数据并提取医疗检验报告信息
- 支持中文医疗报告格式
- 自动数据清理和验证
- 错误处理和重试机制
- 完整的测试覆盖

## 安装和配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在 `.env` 文件中设置API密钥：

```env
DASHSCOPE_API_KEY=your-alibaba-cloud-api-key
```

### 3. 获取API密钥

1. 访问 [Alibaba Cloud Model Studio](https://help.aliyun.com/zh/model-studio/deepseek-api)
2. 注册并登录账户
3. 创建API密钥
4. 将密钥配置到环境变量中

## 使用方法

### 基本用法

```javascript
const AiProcessor = require('./processor/aiProcessor');

// 创建处理器实例
const aiProcessor = new AiProcessor();

// 准备OCR数据（JSON字符串格式）
const ocrDataJson = JSON.stringify([
    {
        "totalTextsFound": 149,
        "imageName": "test1.jpg",
        "textResults": [
            // OCR识别的文本结果数组
        ]
    }
]);

// 处理OCR数据
const labReportInstances = await aiProcessor.processOcrDataList(ocrDataJson);

console.log('生成的LabReport实例:', labReportInstances);
```

### 输出格式

处理器会返回符合LabReport模型格式的实例数组：

```json
[
    {
        "patient": "患者姓名",
        "reportTime": "2025-03-22T15:52:00.000Z",
        "doctor": "医生姓名",
        "reportImage": "test1.jpg",
        "hospital": "医院名称",
        "workspaceId": null,
        "items": [
            {
                "itemName": "白细胞计数",
                "result": "7.65",
                "unit": "10^9/L",
                "referenceValue": "3.5-9.5"
            }
        ]
    }
]
```

## API 参考

### 构造函数

```javascript
new AiProcessor()
```

创建一个新的AiProcessor实例。需要设置 `DASHSCOPE_API_KEY` 环境变量。

### 方法

#### `processOcrDataList(ocrDataListJson)`

处理OCR数据列表并返回LabReport实例数组。

**参数:**
- `ocrDataListJson` (string): OCR数据列表的JSON字符串

**返回值:**
- `Promise<Array>`: LabReport实例数组

**示例:**
```javascript
const instances = await aiProcessor.processOcrDataList(jsonString);
```

#### `getStatus()`

获取处理器状态信息。

**返回值:**
- `Object`: 状态信息对象

**示例:**
```javascript
const status = aiProcessor.getStatus();
console.log(status);
// 输出: { name: 'AiProcessor', apiKeyConfigured: true, model: 'deepseek-r1', ... }
```

## 数据格式

### 输入格式 (OCR数据)

```json
[
    {
        "totalTextsFound": 149,
        "imageName": "test1.jpg",
        "textResults": [
            {
                "text": "文本内容",
                "box": {
                    "x": 43,
                    "y": 55,
                    "w": 106,
                    "h": 19
                }
            }
        ]
    }
]
```

### 输出格式 (LabReport实例)

```json
{
    "patient": "患者姓名",
    "reportTime": "2025-03-22T15:52:00.000Z",
    "doctor": "医生姓名",
    "reportImage": "test1.jpg",
    "hospital": "医院名称",
    "workspaceId": null,
    "items": [
        {
            "itemName": "检验项目名称",
            "result": "检验结果",
            "unit": "单位",
            "referenceValue": "参考值"
        }
    ]
}
```

## 错误处理

处理器包含完整的错误处理机制：

- **API密钥错误**: 检查环境变量配置
- **网络错误**: 自动重试和错误报告
- **数据格式错误**: 详细的错误信息
- **AI模型错误**: 解析和验证响应

### 常见错误

1. **DASHSCOPE_API_KEY环境变量未设置**
   ```
   Error: DASHSCOPE_API_KEY environment variable is required
   ```

2. **OCR数据格式错误**
   ```
   Error: OCR数据JSON解析失败: Unexpected token
   ```

3. **AI模型响应格式错误**
   ```
   Error: AI模型返回结果格式异常
   ```

## 测试

运行测试：

```bash
# 运行所有测试
npm test

# 运行AI处理器测试
npm test -- tests/aiProcessor.test.js
```

## 示例

查看 `examples/aiProcessorExample.js` 文件获取完整的使用示例。

## 注意事项

1. **API限制**: 注意Alibaba Cloud DashScope API的调用频率和配额限制
2. **数据隐私**: 确保OCR数据不包含敏感信息
3. **错误处理**: 在生产环境中实现适当的错误处理和重试机制
4. **性能优化**: 对于大量数据，考虑批量处理

## 更新日志

- **v1.0.0**: 初始版本，支持基本的OCR数据处理功能 