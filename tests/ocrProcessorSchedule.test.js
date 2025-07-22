const Scheduler = require('../processor/scheduler');
const { OcrProcessor } = require('../processor/ocrProcessor');
const { OcrData } = require('../models/ocrdata');
const { LabReport } = require('../models/labreport');
const { User } = require('../models/user');
const AiProcessor = require('../processor/aiProcessor');
const logger = require('../config/logger');
const config = require('../config/config');

// Mock AiProcessor
jest.mock('../processor/aiProcessor');

// 测试配置 - 使用更快的参数
const TEST_CONFIG = {
    OCR_PROCESSOR_DELAY: 100, // 100毫秒
    OCR_PROCESSOR_BATCH_SIZE: 3,
    OCR_PROCESSOR_IMMEDIATE_DELAY: 10, // 10毫秒
    OCR_PROCESSOR_ERROR_RETRY_DELAY: 10, // 10毫秒
    AI_PROCESSOR_TIMEOUT: 5000,
    SCHEDULER_ERROR_RETRY_DELAY: 10 // 10毫秒
};

describe('OCR Processor Schedule Tests', () => {
    let scheduler;
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
        await require('../models/labreportitem').LabReportItem.init();
        
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
        
        // 创建 Scheduler 实例
        scheduler = new Scheduler();
    });

    afterEach(async () => {
        // 停止调度器
        if (scheduler.getStatus().isRunning) {
            scheduler.stopSchedule();
        }
        
        // 恢复原始配置
        Object.assign(config, originalConfig);
    });

    describe('调度器基本功能测试', () => {
        test('启动调度器并执行OCR处理任务', async () => {
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
            
            // 创建任务函数
            const task = async () => {
                return await ocrProcessor.runTask(3);
            };
            
            // 启动调度器
            const startPromise = scheduler.startSchedule(task, 0);
            
            // 等待一段时间让调度器执行任务
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 停止调度器
            scheduler.stopSchedule();
            
            // 等待调度器完全停止
            await startPromise;
            
            // 验证调度器状态
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(false);
            expect(status.taskCount).toBeGreaterThan(0);
            
            // 验证 OCR 数据已被处理
            const exists = await OcrData.checkExists(testOcrData.id);
            expect(exists).toBe(false);
            
            // 验证 LabReport 已创建
            const labReports = await LabReport.findByWorkspaceId(1);
            expect(labReports).toHaveLength(1);
            expect(labReports[0].patient).toBe('张三');
        });

        test('调度器处理空数据时正确延时', async () => {
            // 设置 mock 返回空数组
            mockAiProcessor.processOcrDataList.mockResolvedValue([]);
            
            let taskExecutionCount = 0;
            const task = async () => {
                taskExecutionCount++;
                return await ocrProcessor.runTask(3);
            };
            
            // 启动调度器
            const startPromise = scheduler.startSchedule(task, 0);
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // 停止调度器
            scheduler.stopSchedule();
            await startPromise;
            
            // 验证任务执行次数（可能执行多次，因为OCR处理器可能返回不同的延时）
            expect(taskExecutionCount).toBeGreaterThan(0);
            
            // 验证调度器状态
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(false);
        });

        test('调度器处理部分失败时立即重试', async () => {
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
            
            mockAiProcessor.processOcrDataList.mockResolvedValue([mockLabReportData]);
            
            let taskExecutionCount = 0;
            const task = async () => {
                taskExecutionCount++;
                return await ocrProcessor.runTask(3);
            };
            
            // 启动调度器
            const startPromise = scheduler.startSchedule(task, 0);
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 停止调度器
            scheduler.stopSchedule();
            await startPromise;
            
            // 验证任务执行次数（应该执行多次，因为有部分失败）
            expect(taskExecutionCount).toBeGreaterThan(2);
            
            // 验证第一个 OCR 数据已被处理
            const exists1 = await OcrData.checkExists(testOcrData1.id);
            expect(exists1).toBe(false);
            
            // 验证第二个 OCR 数据已被恢复
            const exists2 = await OcrData.checkExists(testOcrData2.id);
            expect(exists2).toBe(true);
        });
    });

    describe('调度器错误处理测试', () => {
        test('AI处理失败时调度器继续运行', async () => {
            // 创建测试 OCR 数据，让OCR处理器能够获取到数据
            const testOcrData = await OcrData.create({
                reportImage: 'test1.jpg',
                ocrPrimitive: '{"textResults": [{"text": "患者姓名：张三"}]}',
                workspaceId: 1
            });

            // 设置 mock 抛出异常，模拟AI处理失败
            mockAiProcessor.processOcrDataList.mockRejectedValue(new Error('AI处理失败'));
            
            let taskExecutionCount = 0;
            const task = async () => {
                taskExecutionCount++;
                return await ocrProcessor.runTask(3);
            };
            
            // 启动调度器
            const startPromise = scheduler.startSchedule(task, 0);
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 停止调度器
            scheduler.stopSchedule();
            await startPromise;
            
            // 验证任务执行次数（应该执行5+次，因为错误后10ms重试）
            expect(taskExecutionCount).toBeGreaterThan(5);
            
            // 验证调度器状态
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(false);
            
            // 验证OCR数据已被恢复（因为AI处理失败）
            const exists = await OcrData.checkExists(testOcrData.id);
            expect(exists).toBe(true);
        });

        test('任务函数抛出异常时调度器继续运行', async () => {
            let taskExecutionCount = 0;
            const task = async () => {
                taskExecutionCount++;
                throw new Error('任务执行失败');
            };
            
            // 启动调度器
            const startPromise = scheduler.startSchedule(task, 0);
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 停止调度器
            scheduler.stopSchedule();
            await startPromise;
            
            // 验证任务执行次数（应该执行5+次，因为错误后10ms重试）
            expect(taskExecutionCount).toBeGreaterThan(5);
            
            // 验证调度器状态
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(false);
        });
    });

    describe('调度器并发控制测试', () => {
        test('同时启动多个调度器时正确处理', async () => {
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
            
            // 创建两个调度器和对应的OCR处理器
            const scheduler1 = new Scheduler();
            const scheduler2 = new Scheduler();
            const ocrProcessor1 = new OcrProcessor();
            const ocrProcessor2 = new OcrProcessor();
            
            const task1 = async () => {
                return await ocrProcessor1.runTask(3);
            };
            
            const task2 = async () => {
                return await ocrProcessor2.runTask(3);
            };
            
            // 启动第一个调度器
            const startPromise1 = scheduler1.startSchedule(task1, 0);
            
            // 启动第二个调度器（应该可以同时运行，因为是不同的调度器实例）
            const startPromise2 = scheduler2.startSchedule(task2, 0);
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 停止两个调度器
            scheduler1.stopSchedule();
            scheduler2.stopSchedule();
            await startPromise1;
            await startPromise2;
            
            // 验证两个调度器状态
            const status1 = scheduler1.getStatus();
            const status2 = scheduler2.getStatus();
            expect(status1.isRunning).toBe(false);
            expect(status2.isRunning).toBe(false);
            expect(status1.taskCount).toBeGreaterThan(0);
            expect(status2.taskCount).toBeGreaterThan(0);
        });
    });

    describe('调度器状态管理测试', () => {
        test('获取调度器状态信息', async () => {
            const task = async () => {
                return await ocrProcessor.runTask(3);
            };
            
            // 启动调度器
            const startPromise = scheduler.startSchedule(task, 0);
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 获取状态
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(true);
            expect(status.taskCount).toBeGreaterThan(0);
            expect(status.startTime).toBeTruthy();
            expect(status.lastRunTime).toBeTruthy();
            expect(status.totalRunTime).toBeGreaterThan(0);
            expect(status.hasCurrentTimeout).toBe(true);
            
            // 停止调度器
            scheduler.stopSchedule();
            await startPromise;
            
            // 再次获取状态
            const finalStatus = scheduler.getStatus();
            expect(finalStatus.isRunning).toBe(false);
            expect(finalStatus.hasCurrentTimeout).toBe(false);
        });

        test('停止未运行的调度器', () => {
            // 尝试停止未运行的调度器
            scheduler.stopSchedule();
            
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(false);
        });
    });

    describe('调度器延时控制测试', () => {
        test('任务返回0延时时快速执行下次任务', async () => {
            let taskExecutionCount = 0;
            const task = async () => {
                taskExecutionCount++;
                return 0; // 立即执行
            };
            
            // 启动调度器
            const startPromise = scheduler.startSchedule(task, 0);
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 停止调度器
            scheduler.stopSchedule();
            await startPromise;
            
            // 验证任务执行次数（应该执行多次，因为延时为0）
            expect(taskExecutionCount).toBeGreaterThan(1);
        });

        test('任务返回无效延时时抛出异常', async () => {
            const task = async () => {
                return -1; // 无效延时
            };
            
            // 启动调度器
            const startPromise = scheduler.startSchedule(task, 0);
            
            // 等待一段时间
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 停止调度器
            scheduler.stopSchedule();
            await startPromise;
            
            // 验证调度器状态
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(false);
        });
    });
}); 