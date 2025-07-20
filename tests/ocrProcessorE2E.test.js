const { OcrProcessor } = require('../processor/ocrProcessor');
const { OcrData } = require('../models/ocrdata');
const { LabReport } = require('../models/labreport');
const { LabReportItem } = require('../models/labreportitem');
const { User } = require('../models/user');
const AiProcessor = require('../processor/aiProcessor');
const logger = require('../config/logger');
const config = require('../config/config');

// Mock AiProcessor
jest.mock('../processor/aiProcessor');

// 测试配置 - 使用更快的参数
const TEST_CONFIG = {
    OCR_PROCESSOR_DELAY: 1000, // 1秒
    OCR_PROCESSOR_BATCH_SIZE: 5,
    OCR_PROCESSOR_IMMEDIATE_DELAY: 10, // 10毫秒
    OCR_PROCESSOR_ERROR_RETRY_DELAY: 10, // 10毫秒
    AI_PROCESSOR_TIMEOUT: 5000
};

describe('OcrProcessor E2E Tests', () => {
    let ocrProcessor;
    let mockAiProcessor;
    let originalConfig;

    beforeEach(async () => {
        // 保存原始配置
        originalConfig = { ...config };
        
        // 替换配置为测试配置
        Object.assign(config, TEST_CONFIG);
        
        // 初始化模型
        await User.init();
        await require('../models/workspace').Workspace.init();
        await OcrData.init();
        await LabReport.init();
        await LabReportItem.init();
        
        // 创建测试用户
        const testUser = await User.create('testuser', 'password123');
        
        // 创建测试工作空间
        const { Workspace } = require('../models/workspace');
        await Workspace.create({ 
            name: 'Test Workspace',
            userId: testUser.id
        });
        
        // 重置 mock
        jest.clearAllMocks();
        
        // 创建 mock AiProcessor 实例
        mockAiProcessor = {
            processOcrDataList: jest.fn()
        };
        
        // 替换 AiProcessor 构造函数
        AiProcessor.mockImplementation(() => mockAiProcessor);
        
        // 创建 OcrProcessor 实例
        ocrProcessor = new OcrProcessor();
    });

    afterEach(async () => {
        // 恢复原始配置
        Object.assign(config, originalConfig);
    });

    describe('runTask - 基本功能测试', () => {
        test('没有待处理数据时返回配置的延时', async () => {
            // 设置 mock 返回空数组
            mockAiProcessor.processOcrDataList.mockResolvedValue([]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY);
            expect(mockAiProcessor.processOcrDataList).not.toHaveBeenCalled();
        });

        test('成功处理所有数据时返回配置的延时', async () => {
            // 创建测试 OCR 数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回成功结果
            const mockLabReportData = {
                ocrdataId: testOcrData.id,
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test1.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY);
            // 验证调用参数，忽略 deletedAt 字段的差异
            const callArgs = mockAiProcessor.processOcrDataList.mock.calls[0][0];
            expect(callArgs).toHaveLength(1);
            expect(callArgs[0].id).toBe(testOcrData.id);
            expect(callArgs[0].reportImage).toBe(testOcrData.reportImage);
            expect(callArgs[0].ocrPrimitive).toBe(testOcrData.ocrPrimitive);
            expect(callArgs[0].workspaceId).toBe(testOcrData.workspaceId);
            
            // 验证 OCR 数据已被硬删除
            const exists = await OcrData.checkExists(testOcrData.id);
            expect(exists).toBe(false);
            
            // 验证 LabReport 已创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(1);
            expect(labReports[0].patient).toBe('张三');
        });

        test('部分数据提取失败时返回立即延时', async () => {
            // 创建测试 OCR 数据
            const testOcrData1 = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });
            
            const testOcrData2 = await OcrData.create({
                reportImage: 'test2.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：李四"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回部分成功结果
            const mockLabReportData = {
                ocrdataId: testOcrData1.id,
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test1.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData, null]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_IMMEDIATE_DELAY);
            // 验证调用参数，忽略 deletedAt 字段的差异
            const callArgs = mockAiProcessor.processOcrDataList.mock.calls[0][0];
            expect(callArgs).toHaveLength(2);
            expect(callArgs[0].id).toBe(testOcrData1.id);
            expect(callArgs[1].id).toBe(testOcrData2.id);
            
            // 验证第一个 OCR 数据已被硬删除
            const exists1 = await OcrData.checkExists(testOcrData1.id);
            expect(exists1).toBe(false);
            
            // 验证第二个 OCR 数据已被恢复
            const exists2 = await OcrData.checkExists(testOcrData2.id);
            expect(exists2).toBe(true);
            
            // 验证 LabReport 已创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(1);
        });

        test('达到批次大小且全部成功时返回立即延时', async () => {
            // 创建测试 OCR 数据（正好达到批次大小）
            const testOcrDataList = [];
            for (let i = 0; i < 5; i++) {
                const testOcrData = await OcrData.create({
                    reportImage: `test${i}.jpg`,
                    ocrPrimitive: `{"textResults": [{"text": "患者姓名：患者${i}"}]}`,
                    workspaceId: 1
                });
                testOcrDataList.push(testOcrData);
            }

            // 设置 mock 返回成功结果
            const mockLabReportDataList = testOcrDataList.map((ocrData, index) => ({
                ocrdataId: ocrData.id,
                patient: `患者${index}`,
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: `test${index}.jpg`,
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            }));
            
            mockAiProcessor.processOcrDataList.mockResolvedValue(mockLabReportDataList);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_IMMEDIATE_DELAY); // 达到批次大小，返回立即延时
            // 验证调用参数，忽略 deletedAt 字段的差异
            const callArgs = mockAiProcessor.processOcrDataList.mock.calls[0][0];
            expect(callArgs).toHaveLength(5);
            expect(callArgs[0].id).toBe(testOcrDataList[0].id);
            expect(callArgs[4].id).toBe(testOcrDataList[4].id);
            
            // 验证所有OCR数据已被硬删除
            for (let i = 0; i < 5; i++) {
                const exists = await OcrData.checkExists(testOcrDataList[i].id);
                expect(exists).toBe(false);
            }
            
            // 验证所有LabReport被创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(5);
        });

        test('未达到批次大小时返回配置的延时', async () => {
            // 创建测试 OCR 数据（未达到批次大小）
            const testOcrDataList = [];
            for (let i = 0; i < 3; i++) {
                const testOcrData = await OcrData.create({
                    reportImage: `test${i}.jpg`,
                    ocrPrimitive: `{"textResults": [{"text": "患者姓名：患者${i}"}]}`,
                    workspaceId: 1
                });
                testOcrDataList.push(testOcrData);
            }

            // 设置 mock 返回成功结果
            const mockLabReportDataList = testOcrDataList.map((ocrData, index) => ({
                ocrdataId: ocrData.id,
                patient: `患者${index}`,
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: `test${index}.jpg`,
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            }));
            
            mockAiProcessor.processOcrDataList.mockResolvedValue(mockLabReportDataList);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY); // 未达到批次大小且全部成功，返回配置的延时
            // 验证调用参数，忽略 deletedAt 字段的差异
            const callArgs = mockAiProcessor.processOcrDataList.mock.calls[0][0];
            expect(callArgs).toHaveLength(3);
            expect(callArgs[0].id).toBe(testOcrDataList[0].id);
            expect(callArgs[2].id).toBe(testOcrDataList[2].id);
            
            // 验证所有OCR数据已被硬删除
            for (let i = 0; i < 3; i++) {
                const exists = await OcrData.checkExists(testOcrDataList[i].id);
                expect(exists).toBe(false);
            }
            
            // 验证所有LabReport被创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(3);
        });
    });

    describe('runTask - 客户端删除场景测试', () => {
        test('OCR数据被客户端删除时丢弃提取结果', async () => {
            // 创建测试 OCR 数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回成功结果
            const mockLabReportData = {
                ocrdataId: testOcrData.id,
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test1.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData]);
            
            // 在 AI 处理之前删除 OCR 数据
            await OcrData.hardDeleteBatch([testOcrData.id]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY);
            // 由于OCR数据被删除，AI处理器不会被调用
            expect(mockAiProcessor.processOcrDataList).not.toHaveBeenCalled();
            
            // 验证 LabReport 未创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(0);
        });

        test('OCR数据提取失败且被客户端删除时不恢复', async () => {
            // 创建测试 OCR 数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回失败结果
            mockAiProcessor.processOcrDataList.mockResolvedValue([null]);
            
            // 在 AI 处理之前删除 OCR 数据
            await OcrData.hardDeleteBatch([testOcrData.id]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY);
            // 由于OCR数据被删除，AI处理器不会被调用
            expect(mockAiProcessor.processOcrDataList).not.toHaveBeenCalled();
            
            // 验证 OCR 数据未被恢复
            const exists = await OcrData.checkExists(testOcrData.id);
            expect(exists).toBe(false);
        });
    });

    describe('runTask - AI处理失败场景测试', () => {
        test('AI处理抛出异常时恢复所有数据并返回配置的延时', async () => {
            // 创建测试 OCR 数据
            const testOcrData1 = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });
            
            const testOcrData2 = await OcrData.create({
                reportImage: 'test2.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：李四"}]}',
                workspaceId: 1
            });

            // 设置 mock 抛出异常
            mockAiProcessor.processOcrDataList.mockRejectedValue(new Error('AI处理失败'));
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_ERROR_RETRY_DELAY);
            // 验证调用参数，忽略 deletedAt 字段的差异
            const callArgs = mockAiProcessor.processOcrDataList.mock.calls[0][0];
            expect(callArgs).toHaveLength(2);
            expect(callArgs[0].id).toBe(testOcrData1.id);
            expect(callArgs[1].id).toBe(testOcrData2.id);
            
            // 验证所有 OCR 数据已被恢复
            const exists1 = await OcrData.checkExists(testOcrData1.id);
            const exists2 = await OcrData.checkExists(testOcrData2.id);
            expect(exists1).toBe(true);
            expect(exists2).toBe(true);
            
            // 验证 LabReport 未创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(0);
        });

        test('AI处理返回格式错误时恢复数据并返回立即延时', async () => {
            // 创建测试 OCR 数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回格式错误的结果
            mockAiProcessor.processOcrDataList.mockResolvedValue([{
                ocrdataId: testOcrData.id,
                // 缺少必需字段
                patient: '张三'
                // 缺少 reportTime, items 等字段
            }]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_IMMEDIATE_DELAY); // 格式错误导致处理失败，数据被恢复，返回立即延时
            // 验证调用参数，忽略 deletedAt 字段的差异
            const callArgs = mockAiProcessor.processOcrDataList.mock.calls[0][0];
            expect(callArgs).toHaveLength(1);
            expect(callArgs[0].id).toBe(testOcrData.id);
            
            // 验证 OCR 数据已被恢复（因为格式错误被作为未成功提取处理）
            const exists = await OcrData.checkExists(testOcrData.id);
            expect(exists).toBe(true);
            
            // 验证 LabReport 未创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(0);
        });

        test('处理未提取OCR数据时发生错误直接跳过', async () => {
            // 创建测试 OCR 数据（达到批次大小）
            const testOcrDataList = [];
            for (let i = 0; i < 5; i++) {
                const testOcrData = await OcrData.create({
                    reportImage: `test${i}.jpg`,
                    ocrPrimitive: `{"textResults": [{"text": "患者姓名：患者${i}"}]}`,
                    workspaceId: 1
                });
                testOcrDataList.push(testOcrData);
            }

            // 设置 mock 返回部分成功结果（只有第一个成功）
            const mockLabReportData = {
                ocrdataId: testOcrDataList[0].id,
                patient: '患者0',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test0.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData]);
            
            // Mock OcrData.restore 方法抛出异常
            const originalRestore = OcrData.restore;
            OcrData.restore = jest.fn().mockRejectedValue(new Error('数据库错误'));
            
            const delay = await ocrProcessor.runTask(5);
            
            // 恢复原始方法
            OcrData.restore = originalRestore;
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_IMMEDIATE_DELAY); // 达到批次大小，返回立即延时
            
            // 验证第一个 OCR 数据已被硬删除
            const exists1 = await OcrData.checkExists(testOcrDataList[0].id);
            expect(exists1).toBe(false);
            
            // 验证其他 OCR 数据仍然存在（因为恢复失败被跳过）
            for (let i = 1; i < 5; i++) {
                const exists = await OcrData.checkExists(testOcrDataList[i].id);
                expect(exists).toBe(true);
            }
            
            // 验证只有一个 LabReport 被创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(1);
        });
    });

    describe('runTask - 并发处理测试', () => {
        test('同时调用runTask时跳过重复执行', async () => {
            // 创建测试 OCR 数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回成功结果
            const mockLabReportData = {
                ocrdataId: testOcrData.id,
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test1.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData]);
            
            // 同时调用两次 runTask
            const [delay1, delay2] = await Promise.all([
                ocrProcessor.runTask(5),
                ocrProcessor.runTask(5)
            ]);
            
            expect(delay1).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY);
            expect(delay2).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY);
            
            // 验证 AI 处理只被调用一次
            expect(mockAiProcessor.processOcrDataList).toHaveBeenCalledTimes(1);
        });
    });

    describe('runTask - ocrdataId匹配测试', () => {
        test('基于ocrdataId正确匹配OCR数据和LabReport结果', async () => {
            // 创建测试 OCR 数据
            const testOcrData1 = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });
            
            const testOcrData2 = await OcrData.create({
                reportImage: 'test2.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：李四"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回结果，但顺序与输入不同
            const mockLabReportData1 = {
                ocrdataId: testOcrData1.id,
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test1.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            const mockLabReportData2 = {
                ocrdataId: testOcrData2.id,
                patient: '李四',
                reportTime: new Date().toISOString(),
                doctor: '王医生',
                reportImage: 'test2.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '8.12',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            // 返回结果顺序与输入不同，测试基于ocrdataId的匹配
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData2, mockLabReportData1]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY);
            
            // 验证两个 OCR 数据都被正确处理
            const exists1 = await OcrData.checkExists(testOcrData1.id);
            const exists2 = await OcrData.checkExists(testOcrData2.id);
            expect(exists1).toBe(false);
            expect(exists2).toBe(false);
            
            // 验证两个 LabReport 都已创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(2);
            
            // 验证 LabReport 数据正确
            const patientNames = labReports.map(report => report.patient).sort();
            expect(patientNames).toEqual(['张三', '李四']);
        });

        test('LabReport数据缺少ocrdataId字段时跳过处理', async () => {
            // 创建测试 OCR 数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回缺少ocrdataId的结果
            const mockLabReportData = {
                // 缺少 ocrdataId 字段
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test1.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_IMMEDIATE_DELAY); // 有未处理的OCR数据，返回立即延时
            
            // 验证 OCR 数据未被处理（因为缺少ocrdataId）
            const exists = await OcrData.checkExists(testOcrData.id);
            expect(exists).toBe(true);
            
            // 验证 LabReport 未创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(0);
        });

        test('未找到对应OCR数据的LabReport结果时跳过处理', async () => {
            // 创建测试 OCR 数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回错误的ocrdataId
            const mockLabReportData = {
                ocrdataId: 99999, // 不存在的OCR数据ID
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test1.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData]);
            
            const delay = await ocrProcessor.runTask(5);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_IMMEDIATE_DELAY); // 有未处理的OCR数据，返回立即延时
            
            // 验证 OCR 数据未被处理（因为找不到对应的LabReport结果）
            const exists = await OcrData.checkExists(testOcrData.id);
            expect(exists).toBe(true);
            
            // 验证 LabReport 未创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(0);
        });
    });

    describe('runTask - 边界条件测试', () => {
        test('批次大小为1时的处理', async () => {
            // 创建测试 OCR 数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 返回成功结果
            const mockLabReportData = {
                ocrdataId: testOcrData.id,
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                reportImage: 'test1.jpg',
                hospital: '测试医院',
                workspaceId: 1,
                items: [
                    {
                        itemName: '血常规',
                        result: '7.65',
                        unit: '10^9/L',
                        referenceValue: '3.5-9.5'
                    }
                ]
            };
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData]);
            
            const delay = await ocrProcessor.runTask(1);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_IMMEDIATE_DELAY); // 达到批次大小，返回立即延时
            // 验证调用参数，忽略 deletedAt 字段的差异
            const callArgs = mockAiProcessor.processOcrDataList.mock.calls[0][0];
            expect(callArgs).toHaveLength(1);
            expect(callArgs[0].id).toBe(testOcrData.id);
        });

        test('批次大小为0时的处理', async () => {
            const delay = await ocrProcessor.runTask(0);
            
            expect(delay).toBe(TEST_CONFIG.OCR_PROCESSOR_DELAY);
            expect(mockAiProcessor.processOcrDataList).not.toHaveBeenCalled();
        });
    });
}); 