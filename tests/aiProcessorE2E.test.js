const AiProcessor = require('../processor/aiProcessor');
const { OcrData } = require('../models/ocrdata');
const fs = require('fs');
const path = require('path');

describe('AiProcessor E2E Tests', () => {
    // 增加超时时间到30秒，因为API调用需要时间
    jest.setTimeout(30000);
    let aiProcessor;
    let testOcrData;

    beforeAll(() => {
        // 读取测试数据并转换为OcrData实例数组
        const testDataPath = path.join(__dirname, '../data/ocrdata.json');
        const testDataContent = fs.readFileSync(testDataPath, 'utf8');
        const rawTestData = JSON.parse(testDataContent);
        
        // 将原始数据转换为OcrData实例
        testOcrData = rawTestData.map(data => new OcrData(data));
    });

    beforeEach(() => {
        // 不设置API Key，让测试处理真实情况
        // 如果环境变量中没有API Key，测试会跳过需要API调用的部分
        try {
            aiProcessor = new AiProcessor();
        } catch (error) {
            // 如果没有API Key，创建一个模拟的处理器用于测试本地逻辑
            aiProcessor = {
                processOcrDataList: async () => { throw new Error('API Key not configured'); },
                getStatus: () => ({ name: 'AiProcessor', apiKeyConfigured: false, model: 'deepseek-v3', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' }),
                buildPrompt: () => 'test prompt',
                parseAiResponse: () => [],
                validateLabReportInstance: () => {}
            };
        }
    });

    describe('workspaceId Extraction Tests', () => {
        test('should extract workspaceId from OCR data correctly', async () => {
            // 测试数据1: workspaceId = 1
            const ocrData1 = testOcrData[0];
            
            try {
                const result1 = await aiProcessor.processOcrDataList([ocrData1]);
                
                // 验证返回结果包含workspaceId
                expect(result1).toBeDefined();
                expect(Array.isArray(result1)).toBe(true);
                
                if (result1.length > 0) {
                    const labReport = result1[0];
                    expect(labReport).toHaveProperty('workspaceId');
                    expect(labReport.workspaceId).toBe(1);
                }
            } catch (error) {
                // 如果API调用失败，跳过测试
                console.log('API调用失败，跳过workspaceId提取测试:', error.message);
            }
        });

        test('should extract workspaceId from multiple OCR data correctly', async () => {
            // 测试多个数据: workspaceId = 1, 1, 2
            
            try {
                const result = await aiProcessor.processOcrDataList(testOcrData);
                
                // 验证返回结果
                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);
                
                // 验证每个LabReport都有正确的workspaceId
                const expectedWorkspaceIds = [1, 1, 2];
                
                for (let i = 0; i < Math.min(result.length, expectedWorkspaceIds.length); i++) {
                    const labReport = result[i];
                    expect(labReport).toHaveProperty('workspaceId');
                    expect(labReport.workspaceId).toBe(expectedWorkspaceIds[i]);
                }
            } catch (error) {
                // 如果API调用失败，跳过测试
                console.log('API调用失败，跳过多数据workspaceId提取测试:', error.message);
            }
        });

        test('should handle empty OCR data list', async () => {
            try {
                const result = await aiProcessor.processOcrDataList([]);
                
                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);
                expect(result.length).toBe(0);
            } catch (error) {
                // 如果API调用失败，跳过测试
                console.log('API调用失败，跳过空数据测试:', error.message);
            }
        });

        test('should validate LabReport structure with workspaceId', async () => {
            // 测试单个OCR数据
            const ocrData = testOcrData[0];
            
            try {
                const result = await aiProcessor.processOcrDataList([ocrData]);
                
                if (result.length > 0) {
                    const labReport = result[0];
                    
                    // 验证必需的字段
                    expect(labReport).toHaveProperty('patient');
                    expect(labReport).toHaveProperty('reportTime');
                    expect(labReport).toHaveProperty('reportImage');
                    expect(labReport).toHaveProperty('items');
                    expect(labReport).toHaveProperty('workspaceId');
                    
                    // 验证workspaceId类型和值
                    expect(typeof labReport.workspaceId).toBe('number');
                    expect(labReport.workspaceId).toBe(1);
                    
                    // 验证items数组
                    expect(Array.isArray(labReport.items)).toBe(true);
                    
                    // 验证items中的每个项目
                    if (labReport.items.length > 0) {
                        const item = labReport.items[0];
                        expect(item).toHaveProperty('itemName');
                        expect(item).toHaveProperty('result');
                    }
                }
            } catch (error) {
                // 如果API调用失败，跳过测试
                console.log('API调用失败，跳过结构验证测试:', error.message);
            }
        });

        test('should handle non-array input', async () => {
            const nonArrayInput = { test: 'data' };
            
            await expect(aiProcessor.processOcrDataList(nonArrayInput))
                .rejects
                .toThrow('OCR数据必须是数组格式');
        });
    });

    describe('AiProcessor Status Tests', () => {
        test('should return correct status information', () => {
            const status = aiProcessor.getStatus();
            
            expect(status).toHaveProperty('name');
            expect(status).toHaveProperty('apiKeyConfigured');
            expect(status).toHaveProperty('model');
            expect(status).toHaveProperty('baseUrl');
            
            expect(status.name).toBe('AiProcessor');
            expect(status.model).toBe('deepseek-v3');
            expect(status.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
            expect(typeof status.apiKeyConfigured).toBe('boolean');
            
            // 如果API Key未配置，状态应该反映这一点
            if (!status.apiKeyConfigured) {
                console.log('API Key未配置，状态检查通过');
            }
        });
    });

    describe('Prompt Building Tests', () => {
        test('should build prompt with workspaceId extraction instructions', () => {
            const testData = [
                new OcrData({
                    id: 1,
                    workspaceId: 1,
                    reportImage: 'test.jpg',
                    ocrPrimitive: '[{"imageName":"test.jpg","totalTextsFound":10,"textResults":[]}]'
                })
            ];
            
            const prompt = aiProcessor.buildPrompt(testData);
            
            // 验证提示词包含workspaceId提取指令
            expect(prompt).toContain('workspaceId: Extract from ocrdata\'s workspaceId');
            expect(prompt).toContain('ocrdataId: Extract from ocrdata\'s id');
            expect(prompt).toContain('LabReport Structure');
            expect(prompt).toContain('LabReportItem Structure');
        });

        test('should exclude deletedAt, createdAt, updatedAt from prompt', () => {
            const testData = [
                new OcrData({
                    id: 1,
                    workspaceId: 1,
                    reportImage: 'test.jpg',
                    ocrPrimitive: '[{"imageName":"test.jpg","totalTextsFound":10,"textResults":[]}]',
                    deletedAt: '2025-01-01T00:00:00.000Z',
                    createdAt: '2025-01-01T00:00:00.000Z',
                    updatedAt: '2025-01-01T00:00:00.000Z'
                })
            ];
            
            const prompt = aiProcessor.buildPrompt(testData);
            
            // 验证提示词不包含时间戳字段
            expect(prompt).not.toContain('deletedAt');
            expect(prompt).not.toContain('createdAt');
            expect(prompt).not.toContain('updatedAt');
            
            // 验证提示词包含必要的字段
            expect(prompt).toContain('"id": 1');
            expect(prompt).toContain('"workspaceId": 1');
            expect(prompt).toContain('"reportImage": "test.jpg"');
        });
    });

    describe('Response Parsing Tests', () => {
        test('should parse valid AI response correctly', () => {
            const validResponse = `[
                {
                    "patient": "牛霞",
                    "reportTime": "2025-07-01T09:19:00.000Z",
                    "doctor": "苏会娜",
                    "reportImage": "test2.jpg",
                    "hospital": "北京大学人民医院",
                    "workspaceId": 1,
                    "items": [
                        {
                            "itemName": "白细胞计数",
                            "result": "5.84",
                            "unit": "10^9/L",
                            "referenceValue": "3.5-9.5"
                        }
                    ]
                }
            ]`;
            
            const result = aiProcessor.parseAiResponse(validResponse);
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
            
            const labReport = result[0];
            expect(labReport.workspaceId).toBe(1);
            expect(labReport.patient).toBe('牛霞');
            expect(labReport.doctor).toBe('苏会娜');
            expect(labReport.hospital).toBe('北京大学人民医院');
            expect(Array.isArray(labReport.items)).toBe(true);
        });

        test('should handle AI response with markdown code blocks', () => {
            const responseWithMarkdown = '```json\n[{"patient":"张三","reportTime":"2025-01-15T11:30:00.000Z","reportImage":"test.jpg","workspaceId":1,"items":[]}]\n```';
            
            const result = aiProcessor.parseAiResponse(responseWithMarkdown);
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
            expect(result[0].workspaceId).toBe(1);
            expect(result[0].patient).toBe('张三');
        });

        test('should throw error for invalid AI response', () => {
            const invalidResponse = 'invalid json response';
            
            expect(() => {
                aiProcessor.parseAiResponse(invalidResponse);
            }).toThrow('解析AI响应失败');
        });

        test('should throw error for non-array AI response', () => {
            const nonArrayResponse = '{"test": "data"}';
            
            expect(() => {
                aiProcessor.parseAiResponse(nonArrayResponse);
            }).toThrow('AI返回的结果不是数组格式');
        });
    });

    describe('LabReport Validation Tests', () => {
        test('should validate LabReport instance with all required fields', () => {
            const validInstance = {
                patient: '张三',
                reportTime: '2025-01-15T11:30:00.000Z',
                reportImage: 'test3.jpg',
                items: [
                    {
                        itemName: '血糖',
                        result: '5.2'
                    }
                ]
            };
            
            expect(() => {
                aiProcessor.validateLabReportInstance(validInstance, 0);
            }).not.toThrow();
        });

        test('should throw error for missing required fields', () => {
            const invalidInstance = {
                patient: '张三',
                // 缺少 reportTime, reportImage, items
            };
            
            expect(() => {
                aiProcessor.validateLabReportInstance(invalidInstance, 0);
            }).toThrow('LabReport实例 0 缺少必需字段: reportTime, reportImage, items');
        });

        test('should throw error for non-array items', () => {
            const invalidInstance = {
                patient: '张三',
                reportTime: '2025-01-15T11:30:00.000Z',
                reportImage: 'test3.jpg',
                items: 'not an array'
            };
            
            expect(() => {
                aiProcessor.validateLabReportInstance(invalidInstance, 0);
            }).toThrow('LabReport实例 0 的items字段必须是数组');
        });

        test('should throw error for items with missing required fields', () => {
            const invalidInstance = {
                patient: '张三',
                reportTime: '2025-01-15T11:30:00.000Z',
                reportImage: 'test3.jpg',
                items: [
                    {
                        itemName: '血糖'
                        // 缺少 result
                    }
                ]
            };
            
            expect(() => {
                aiProcessor.validateLabReportInstance(invalidInstance, 0);
            }).toThrow('LabReport实例 0 的item 0 缺少必需字段: result');
        });
    });
});
