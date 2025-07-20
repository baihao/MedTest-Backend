const Scheduler = require('../processor/scheduler');

describe('Scheduler Tests', () => {
    let scheduler;

    beforeEach(() => {
        scheduler = new Scheduler();
    });

    afterEach(() => {
        // 确保测试后停止调度器
        if (scheduler.isRunning) {
            scheduler.stopSchedule();
        }
    });

    describe('Constructor Tests', () => {
        test('should initialize with correct default values', () => {
            expect(scheduler.isRunning).toBe(false);
            expect(scheduler.currentTask).toBe(null);
            expect(scheduler.currentTimeout).toBe(null);
            expect(scheduler.taskCount).toBe(0);
            expect(scheduler.startTime).toBe(null);
            expect(scheduler.lastRunTime).toBe(null);
        });
    });

    describe('Start Schedule Tests', () => {
        test('should start schedule with valid task', async () => {
            const task = jest.fn().mockResolvedValue(1000);
            
            await scheduler.startSchedule(task);
            
            expect(scheduler.isRunning).toBe(true);
            expect(scheduler.currentTask).toBe(task);
            expect(scheduler.startTime).toBeInstanceOf(Date);
            expect(scheduler.taskCount).toBe(1); // 已经执行了一次任务
            
            // 停止调度器
            scheduler.stopSchedule();
        });

        test('should throw error when starting with non-function task', async () => {
            const invalidTask = 'not a function';
            
            await expect(scheduler.startSchedule(invalidTask))
                .rejects
                .toThrow('任务必须是函数');
        });

        test('should throw error when starting already running scheduler', async () => {
            const task = jest.fn().mockResolvedValue(1000);
            
            await scheduler.startSchedule(task);
            
            await expect(scheduler.startSchedule(task))
                .rejects
                .toThrow('调度器已在运行中');
            
            scheduler.stopSchedule();
        });

        test('should start with initial delay', async () => {
            const startTime = Date.now();
            const task = jest.fn().mockResolvedValue(1000);
            const initialDelay = 100;
            
            await scheduler.startSchedule(task, initialDelay);
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeGreaterThanOrEqual(initialDelay - 10); // 允许10ms误差
            
            scheduler.stopSchedule();
        });
    });

    describe('Task Execution Tests', () => {
        test('should execute task and schedule next execution', async () => {
            const task = jest.fn()
                .mockResolvedValueOnce(100)  // 第一次返回100ms
                .mockResolvedValueOnce(200); // 第二次返回200ms
            
            await scheduler.startSchedule(task);
            
            // 等待任务执行
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(task).toHaveBeenCalledTimes(1);
            expect(scheduler.taskCount).toBe(1);
            expect(scheduler.lastRunTime).toBeInstanceOf(Date);
            
            // 等待第二次执行
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(task).toHaveBeenCalledTimes(2);
            expect(scheduler.taskCount).toBe(2);
            
            scheduler.stopSchedule();
        });

        test('should handle task returning 0 delay (immediate execution)', async () => {
            const task = jest.fn()
                .mockResolvedValueOnce(0)   // 立即执行
                .mockResolvedValueOnce(100); // 然后等待100ms
            
            await scheduler.startSchedule(task);
            
            // 等待任务执行
            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(task).toHaveBeenCalledTimes(2); // 应该立即执行了两次
            expect(scheduler.taskCount).toBe(2);
            
            scheduler.stopSchedule();
        });

        test('should handle task throwing error and retry after 5 seconds', async () => {
            const task = jest.fn()
                .mockRejectedValueOnce(new Error('Task failed'))
                .mockResolvedValueOnce(100);
            
            await scheduler.startSchedule(task);
            
            // 等待错误处理和重试
            await new Promise(resolve => setTimeout(resolve, 6000));
            
            expect(task).toHaveBeenCalledTimes(3); // 第一次失败，5秒后重试，然后成功
            expect(scheduler.taskCount).toBe(3);
            
            scheduler.stopSchedule();
        }, 10000); // 增加超时时间到10秒

        test('should throw error for invalid delay return value', async () => {
            const task = jest.fn().mockResolvedValue(-100); // 无效的延迟值
            
            await scheduler.startSchedule(task);
            
            // 等待任务执行和错误处理
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(task).toHaveBeenCalledTimes(1);
            
            scheduler.stopSchedule();
        });

        test('should throw error for non-number delay return value', async () => {
            const task = jest.fn().mockResolvedValue('invalid'); // 非数字延迟值
            
            await scheduler.startSchedule(task);
            
            // 等待任务执行和错误处理
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(task).toHaveBeenCalledTimes(1);
            
            scheduler.stopSchedule();
        });
    });

    describe('Stop Schedule Tests', () => {
        test('should stop running scheduler', async () => {
            const task = jest.fn().mockResolvedValue(1000);
            
            await scheduler.startSchedule(task);
            expect(scheduler.isRunning).toBe(true);
            
            scheduler.stopSchedule();
            
            expect(scheduler.isRunning).toBe(false);
            expect(scheduler.currentTimeout).toBe(null);
        });

        test('should handle stopping non-running scheduler', () => {
            expect(scheduler.isRunning).toBe(false);
            
            // 不应该抛出错误
            expect(() => scheduler.stopSchedule()).not.toThrow();
        });

        test('should clear timeout when stopping', async () => {
            const task = jest.fn().mockResolvedValue(1000);
            
            await scheduler.startSchedule(task);
            
            // 等待任务执行一次
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(scheduler.currentTimeout).not.toBe(null);
            
            scheduler.stopSchedule();
            
            expect(scheduler.currentTimeout).toBe(null);
        });
    });

    describe('Status Tests', () => {
        test('should return correct status when not running', () => {
            const status = scheduler.getStatus();
            
            expect(status).toEqual({
                isRunning: false,
                taskCount: 0,
                startTime: null,
                lastRunTime: null,
                totalRunTime: 0,
                hasCurrentTimeout: false
            });
        });

        test('should return correct status when running', async () => {
            const task = jest.fn().mockResolvedValue(1000);
            
            await scheduler.startSchedule(task);
            
            // 等待任务执行
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const status = scheduler.getStatus();
            
            expect(status.isRunning).toBe(true);
            expect(status.taskCount).toBe(1);
            expect(status.startTime).toBeDefined();
            expect(status.lastRunTime).toBeDefined();
            expect(status.totalRunTime).toBeGreaterThan(0);
            expect(status.hasCurrentTimeout).toBe(true);
            
            scheduler.stopSchedule();
        });

        test('should return correct status after stopping', async () => {
            const task = jest.fn().mockResolvedValue(1000);
            
            await scheduler.startSchedule(task);
            
            // 等待任务执行
            await new Promise(resolve => setTimeout(resolve, 50));
            
            scheduler.stopSchedule();
            
            const status = scheduler.getStatus();
            
            expect(status.isRunning).toBe(false);
            expect(status.taskCount).toBe(1);
            expect(status.startTime).toBeDefined();
            expect(status.lastRunTime).toBeDefined();
            expect(status.totalRunTime).toBeGreaterThan(0);
            expect(status.hasCurrentTimeout).toBe(false);
        });
    });

    describe('Delay Function Tests', () => {
        test('should delay for specified time', async () => {
            const startTime = Date.now();
            const delayTime = 100;
            
            await scheduler.delay(delayTime);
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeGreaterThanOrEqual(delayTime - 10); // 允许10ms误差
        });

        test('should handle zero delay', async () => {
            const startTime = Date.now();
            
            await scheduler.delay(0);
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(10); // 应该几乎立即完成
        });
    });

    describe('Integration Tests', () => {
        test('should handle multiple start/stop cycles', async () => {
            const task = jest.fn().mockResolvedValue(100);
            
            // 第一次启动
            await scheduler.startSchedule(task);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(scheduler.taskCount).toBe(1);
            
            scheduler.stopSchedule();
            
            // 第二次启动
            await scheduler.startSchedule(task);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(scheduler.taskCount).toBe(1); // 重新开始计数
            
            scheduler.stopSchedule();
        });

        test('should handle long-running task with variable delays', async () => {
            let callCount = 0;
            const task = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount >= 3) {
                    return Promise.resolve(1000); // 停止循环，返回长延迟
                }
                return Promise.resolve(50); // 50ms延迟
            });
            
            await scheduler.startSchedule(task);
            
            // 等待多次执行
            await new Promise(resolve => setTimeout(resolve, 200));
            
            expect(task).toHaveBeenCalledTimes(3);
            expect(scheduler.taskCount).toBe(3);
            
            scheduler.stopSchedule();
        });
    });
}); 