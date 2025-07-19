const AiProcessor = require('../processor/aiProcessor');

// Mock environment variables
process.env.DASHSCOPE_API_KEY = 'test-api-key';

describe('AiProcessor', () => {
    let aiProcessor;

    beforeEach(() => {
        aiProcessor = new AiProcessor();
    });

    describe('Constructor', () => {
        test('should initialize with API key', () => {
            expect(aiProcessor.apiKey).toBe('test-api-key');
            expect(aiProcessor.model).toBe('deepseek-r1');
            expect(aiProcessor.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
        });

        test('should throw error if DASHSCOPE_API_KEY is not set', () => {
            delete process.env.DASHSCOPE_API_KEY;
            expect(() => new AiProcessor()).toThrow('DASHSCOPE_API_KEY environment variable is required');
            process.env.DASHSCOPE_API_KEY = 'test-api-key';
        });
    });

    describe('processOcrDataList', () => {
        test('should handle empty array', async () => {
            const result = await aiProcessor.processOcrDataList('[]');
            expect(result).toEqual([]);
        });

        test('should throw error for invalid JSON', async () => {
            await expect(aiProcessor.processOcrDataList('invalid json')).rejects.toThrow('OCR数据JSON解析失败');
        });

        test('should throw error for non-array input', async () => {
            await expect(aiProcessor.processOcrDataList('{"test": "data"}')).rejects.toThrow('OCR数据必须是数组格式');
        });
    });

    describe('buildPrompt', () => {
        test('should build prompt with OCR data', () => {
            const ocrData = [
                {
                    totalTextsFound: 1,
                    imageName: 'test.jpg',
                    textResults: []
                }
            ];
            
            const prompt = aiProcessor.buildPrompt(ocrData);
            
            expect(prompt).toContain('You are a medical data extraction specialist');
            expect(prompt).toContain('test.jpg');
            expect(prompt).toContain('OCR data list:');
        });
    });

    describe('validateLabReportInstance', () => {
        test('should validate correct instance', () => {
            const instance = {
                patient: '张三',
                reportTime: '2025-03-22T15:52:00.000Z',
                reportImage: 'test.jpg',
                items: [
                    {
                        itemName: '白细胞计数',
                        result: '7.65'
                    }
                ]
            };
            
            expect(() => aiProcessor.validateLabReportInstance(instance, 0)).not.toThrow();
        });

        test('should throw error for missing required fields', () => {
            const instance = {
                patient: '张三',
                reportTime: '2025-03-22T15:52:00.000Z'
                // missing reportImage and items
            };
            
            expect(() => aiProcessor.validateLabReportInstance(instance, 0)).toThrow('LabReport实例 0 缺少必需字段: reportImage, items');
        });

        test('should throw error for invalid items array', () => {
            const instance = {
                patient: '张三',
                reportTime: '2025-03-22T15:52:00.000Z',
                reportImage: 'test.jpg',
                items: 'not an array'
            };
            
            expect(() => aiProcessor.validateLabReportInstance(instance, 0)).toThrow('LabReport实例 0 的items字段必须是数组');
        });

        test('should throw error for invalid item structure', () => {
            const instance = {
                patient: '张三',
                reportTime: '2025-03-22T15:52:00.000Z',
                reportImage: 'test.jpg',
                items: [
                    {
                        itemName: '白细胞计数'
                        // missing result
                    }
                ]
            };
            
            expect(() => aiProcessor.validateLabReportInstance(instance, 0)).toThrow('LabReport实例 0 的item 0 缺少必需字段: result');
        });
    });

    describe('parseAiResponse', () => {
        test('should parse valid JSON response', () => {
            const aiResponse = `[
                {
                    "patient": "张三",
                    "reportTime": "2025-03-22T15:52:00.000Z",
                    "reportImage": "test.jpg",
                    "items": [
                        {
                            "itemName": "白细胞计数",
                            "result": "7.65"
                        }
                    ]
                }
            ]`;
            
            const result = aiProcessor.parseAiResponse(aiResponse);
            expect(result).toHaveLength(1);
            expect(result[0].patient).toBe('张三');
        });

        test('should parse JSON with markdown code blocks', () => {
            const aiResponse = '```json\n[{"patient": "张三", "reportTime": "2025-03-22T15:52:00.000Z", "reportImage": "test.jpg", "items": [{"itemName": "白细胞计数", "result": "7.65"}]}]\n```';
            
            const result = aiProcessor.parseAiResponse(aiResponse);
            expect(result).toHaveLength(1);
            expect(result[0].patient).toBe('张三');
        });

        test('should throw error for invalid JSON', () => {
            const aiResponse = 'invalid json';
            
            expect(() => aiProcessor.parseAiResponse(aiResponse)).toThrow('解析AI响应失败');
        });

        test('should throw error for non-array response', () => {
            const aiResponse = '{"test": "data"}';
            
            expect(() => aiProcessor.parseAiResponse(aiResponse)).toThrow('AI返回的结果不是数组格式');
        });
    });

    describe('getStatus', () => {
        test('should return status information', () => {
            const status = aiProcessor.getStatus();
            
            expect(status).toEqual({
                name: 'AiProcessor',
                apiKeyConfigured: true,
                model: 'deepseek-r1',
                baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
            });
        });
    });
}); 