const logger = require('../config/logger');

/**
 * 调度器类 - 支持无限循环调用任务
 * 任务函数返回下次调用的延迟时间（毫秒）
 */
class Scheduler {
    constructor() {
        this.isRunning = false;
        this.currentTask = null;
        this.currentTimeout = null;
        this.taskCount = 0;
        this.startTime = null;
        this.lastRunTime = null;
    }

    /**
     * 启动调度器
     * @param {Function} task - 任务函数，必须返回下次调用的延迟时间（毫秒）
     * @param {number} initialDelay - 初始延迟时间（毫秒），默认为0
     * @returns {Promise<void>}
     */
    async startSchedule(task, initialDelay = 0) {
        if (this.isRunning) {
            throw new Error('调度器已在运行中');
        }

        if (typeof task !== 'function') {
            throw new Error('任务必须是函数');
        }

        this.isRunning = true;
        this.currentTask = task;
        this.startTime = new Date();
        this.taskCount = 0;

        logger.info('调度器启动', JSON.stringify({
            initialDelay,
            startTime: this.startTime.toISOString()
        }, null, 2));

        // 如果有初始延迟，等待后再开始
        if (initialDelay > 0) {
            await this.delay(initialDelay);
        }

        // 开始无限循环
        await this.runTask();
    }

    /**
     * 停止调度器
     */
    stopSchedule() {
        if (!this.isRunning) {
            logger.warn('调度器未在运行');
            return;
        }

        this.isRunning = false;
        
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        const runTime = this.startTime ? new Date() - this.startTime : 0;
        
        logger.info('调度器已停止', JSON.stringify({
            taskCount: this.taskCount,
            totalRunTime: runTime,
            lastRunTime: this.lastRunTime?.toISOString()
        }, null, 2));
    }

    /**
     * 执行任务并安排下次执行
     * @returns {Promise<void>}
     */
    async runTask() {
        if (!this.isRunning) {
            return;
        }

        try {
            this.lastRunTime = new Date();
            this.taskCount++;

            logger.info('开始执行任务', JSON.stringify({
                taskCount: this.taskCount,
                runTime: this.lastRunTime.toISOString()
            }, null, 2));

            // 执行任务并获取下次延迟
            const nextDelay = await this.currentTask();

            // 验证返回的延迟时间
            if (typeof nextDelay !== 'number' || nextDelay < 0) {
                throw new Error(`任务返回的延迟时间无效: ${nextDelay}，必须是大于等于0的数字`);
            }

            logger.info('任务执行完成', JSON.stringify({
                taskCount: this.taskCount,
                nextDelay,
                executionTime: new Date() - this.lastRunTime
            }, null, 2));

            // 如果调度器仍在运行，安排下次执行
            if (this.isRunning) {
                // 即使延时为0，也要使用setTimeout来避免无限循环
                // 使用setImmediate会导致立即执行，可能造成栈溢出
                this.currentTimeout = setTimeout(() => this.runTask(), nextDelay);
            }

        } catch (error) {
            logger.error('任务执行失败', JSON.stringify({
                taskCount: this.taskCount,
                error: error.message,
                stack: error.stack
            }, null, 2));

            // 任务失败时，等待5秒后重试
            if (this.isRunning) {
                logger.info('5秒后重试任务');
                this.currentTimeout = setTimeout(() => this.runTask(), 5000);
            }
        }
    }

    /**
     * 获取调度器状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            taskCount: this.taskCount,
            startTime: this.startTime ? this.startTime.toISOString() : null,
            lastRunTime: this.lastRunTime ? this.lastRunTime.toISOString() : null,
            totalRunTime: this.startTime ? new Date() - this.startTime : 0,
            hasCurrentTimeout: !!this.currentTimeout
        };
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Scheduler; 