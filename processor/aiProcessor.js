require('dotenv').config();
const logger = require('../config/logger');
const OpenAI = require('openai');

class AiProcessor {
    constructor() {
        this.apiKey = process.env.DASHSCOPE_API_KEY;
        this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        this.model = 'deepseek-v3';
        
        if (!this.apiKey) {
            logger.error('DASHSCOPE_API_KEY environment variable is not set');
            throw new Error('DASHSCOPE_API_KEY environment variable is required');
        }

        // Initialize OpenAI client with Alibaba Cloud configuration
        this.openai = new OpenAI({
            apiKey: this.apiKey,
            baseURL: this.baseUrl
        });
    }

    /**
     * 处理OCR数据列表，提取LabReport实例
     * @param {Array} ocrDataList - OCR数据数组，每个元素是OcrData实例
     * @returns {Promise<Array>} LabReport实例数组
     */
    async processOcrDataList(ocrDataList) {
        try {
            logger.info('开始AI处理OCR数据列表');
            
            if (!Array.isArray(ocrDataList)) {
                throw new Error('OCR数据必须是数组格式');
            }

            if (ocrDataList.length === 0) {
                logger.info('OCR数据列表为空');
                return [];
            }

            logger.info(`处理 ${ocrDataList.length} 条OCR数据`);

            // 调用AI模型处理
            const labReportInstances = await this.callAiModel(ocrDataList);
            
            logger.info(`AI处理完成，生成了 ${labReportInstances.length} 个LabReport实例`);
            
            return labReportInstances;

        } catch (error) {
            logger.error('AI处理OCR数据失败:', error);
            throw error;
        }
    }

    /**
     * 调用AI模型处理OCR数据
     * @param {Array} ocrDataList - OCR数据数组
     * @returns {Promise<Array>} LabReport实例数组
     */
    async callAiModel(ocrDataList) {
        try {
            const prompt = this.buildPrompt(ocrDataList);
            
            logger.info('AI模型请求参数:', JSON.stringify({ model: this.model, temperature: 0.1, max_tokens: 4000, top_p: 0.8 }, null, 2));
            logger.info('AI模型请求内容长度:', prompt.length, '字符');
            logger.info('=== AI模型请求内容开始 ===');
            logger.info(prompt);
            logger.info('=== AI模型请求内容结束 ===');            
            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 4000,
                top_p: 0.8
            });
            
            if (!completion || !completion.choices || completion.choices.length === 0) {
                throw new Error('AI模型返回结果格式异常');
            }

            const aiResponse = completion.choices[0].message.content;
            logger.info('AI模型响应:', aiResponse);
            logger.info('AI模型响应长度:', aiResponse.length, '字符');
            logger.info('AI模型响应详情:');
            console.log('=== AI模型响应开始 ===');
            console.log(aiResponse);
            console.log('=== AI模型响应结束 ===');
            // 解析AI返回的JSON
            const labReportInstances = this.parseAiResponse(aiResponse);
            
            return labReportInstances;

        } catch (error) {
            logger.error('调用AI模型失败:', error);
            throw new Error(`AI模型调用失败: ${error.message}`);
        }
    }

    /**
     * 构建AI提示词
     * @param {Array} ocrDataList - OCR数据数组
     * @returns {string} 提示词
     */
    buildPrompt(ocrDataList) {
        // 过滤掉不需要的字段，只保留AI处理需要的字段
        const filteredOcrDataList = ocrDataList.map(ocrData => {
            const { deletedAt, createdAt, updatedAt, ...filteredData } = ocrData;
            return filteredData;
        });
        
        const ocrDataListStr = JSON.stringify(filteredOcrDataList, null, 2);
        
        return `You are a medical data extraction specialist. Your task is to parse OCR data from medical laboratory reports and convert them into structured JSON format that matches the LabReport model schema.

Given an array of OCR data objects, each containing 'totalTextsFound', 'imageName', and 'textResults' (an array of text elements with bounding boxes), extract and structure the following information:

LabReport Structure:
- ocrdataId: Extract from ocrdata's id
- workspaceId: Extract from ocrdata's workspaceId
- patient: Patient name (extract from '姓名：' field)
- reportTime: Report generation time (extract from '报告时间：' field, convert to ISO date format)
- doctor: Doctor name (extract from '申请医生：' field)
- reportImage: Image filename (use the 'imageName' field)
- hospital: Hospital name (extract from hospital name in the report header)
- items: Array of LabReportItem objects

LabReportItem Structure:
- itemName: Test item name (extract from test item descriptions)
- result: Test result value (extract from result column)
- unit: Unit of measurement (extract from unit column)
- referenceValue: Reference range (extract from reference interval column)

Extraction Rules:
1. Patient Information: Look for patterns like '姓名：', '性别：', '年龄：', '卡号/病案号：'
2. Report Metadata: Extract '报告时间：', '申请医生：', '检验项目：'
3. Test Results: Parse the table structure with columns: Test Item, Result, Unit, Reference Range
4. Hospital Information: Extract from report header (e.g., '北京大学人民医院检验报告单')
5. Date Parsing: Convert Chinese date format (YYYY-MM-DD HH:MM) to ISO format

Data Cleaning:
- Remove asterisks (*) from item names but preserve them in the itemName field
- Clean up OCR artifacts and formatting issues
- Handle missing or incomplete data gracefully
- Preserve original Chinese text for item names and descriptions

Output Format:
Return a JSON array where each element represents one lab report with the following structure:

\`\`\`json
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
\`\`\`

Special Handling:
- For multiple test items with the same name but different parameters (e.g., NE%, NE#), create separate items
- Handle abbreviated item names (e.g., 'WBC' → '白细胞计数')
- Preserve the full Chinese descriptions for better readability
- Extract reference ranges even if they appear in separate columns
- Handle cases where units or reference values might be missing
- Only output the json string

Please process the provided OCR data and generate the structured lab report instances following these guidelines.
OCR data list: ${ocrDataListStr}`;
    }

    /**
     * 解析AI模型返回的响应
     * @param {string} aiResponse - AI模型返回的响应文本
     * @returns {Array} LabReport实例数组
     */
    parseAiResponse(aiResponse) {
        try {
            // 清理响应文本，提取JSON部分
            let jsonStr = aiResponse.trim();
            
            // 查找JSON代码块
            const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            } else {
                // 如果没有找到代码块，尝试直接解析
                // 移除可能的markdown代码块标记
                if (jsonStr.startsWith('```json')) {
                    jsonStr = jsonStr.substring(7);
                }
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.substring(3);
                }
                if (jsonStr.endsWith('```')) {
                    jsonStr = jsonStr.substring(0, jsonStr.length - 3);
                }
                
                jsonStr = jsonStr.trim();
            }

            // 解析JSON
            const labReportInstances = JSON.parse(jsonStr);
            
            if (!Array.isArray(labReportInstances)) {
                throw new Error('AI返回的结果不是数组格式');
            }

            // 验证每个实例的基本结构
            for (let i = 0; i < labReportInstances.length; i++) {
                const instance = labReportInstances[i];
                this.validateLabReportInstance(instance, i);
            }

            logger.info(`成功解析 ${labReportInstances.length} 个LabReport实例`);
            return labReportInstances;

        } catch (error) {
            logger.error('解析AI响应失败:', error);
            logger.error('AI原始响应:', aiResponse);
            throw new Error(`解析AI响应失败: ${error.message}`);
        }
    }

    /**
     * 验证LabReport实例的基本结构
     * @param {Object} instance - LabReport实例
     * @param {number} index - 实例索引
     */
    validateLabReportInstance(instance, index) {
        const requiredFields = ['patient', 'reportTime', 'reportImage', 'items'];
        const missingFields = requiredFields.filter(field => !instance.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
            throw new Error(`LabReport实例 ${index} 缺少必需字段: ${missingFields.join(', ')}`);
        }

        if (!Array.isArray(instance.items)) {
            throw new Error(`LabReport实例 ${index} 的items字段必须是数组`);
        }

        // 验证items数组中的每个项目
        for (let i = 0; i < instance.items.length; i++) {
            const item = instance.items[i];
            const itemRequiredFields = ['itemName', 'result'];
            const itemMissingFields = itemRequiredFields.filter(field => !item.hasOwnProperty(field));
            
            if (itemMissingFields.length > 0) {
                throw new Error(`LabReport实例 ${index} 的item ${i} 缺少必需字段: ${itemMissingFields.join(', ')}`);
            }
        }
    }

    /**
     * 获取处理器状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            name: 'AiProcessor',
            apiKeyConfigured: !!this.apiKey,
            model: this.model,
            baseUrl: this.baseUrl
        };
    }
}

module.exports = AiProcessor;
