const { OcrData } = require('../models/ocrdata');
const { LabReport } = require('../models/labreport');
const AiProcessor = require('./aiProcessor');
const logger = require('../config/logger');
const config = require('../config/config');
const { getUserIdFromLabReport } = require('../config/utils');

class OcrProcessor {
    constructor(wsServer = null, aiProcessor = null) {
        this.isProcessing = false;
        this.aiProcessor = aiProcessor || new AiProcessor();
        this.wsServer = wsServer;
    }

    setWsServer(wsServer) {
        this.wsServer = wsServer;
    }

    /**
     * 运行OCR处理任务
     * @param {number} batchSize - 批次大小，默认5
     * @returns {Promise<number>} 下次执行任务的延时（毫秒）
     */
    async runTask(batchSize = config.OCR_PROCESSOR_BATCH_SIZE) {
        if (this.isProcessing) {
            logger.warn('OCR处理器正在运行中，跳过本次处理, 在' + config.OCR_PROCESSOR_DELAY + 'ms后重试');
            return config.OCR_PROCESSOR_DELAY; // 30秒后重试
        }

        this.isProcessing = true;
        let processedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        let hasPartialFailure = false;
        let ocrDataList = [];

        try {
            logger.info(`开始OCR处理任务，批次大小: ${batchSize}`);

            // 1. 使用 getAndSoftDelete 函数获取所要处理的 ocrdata list 数据
            ocrDataList = await OcrData.getAndSoftDelete(batchSize);
            
            // 2. 如果没有返回任何 ocrdata 数据，则直接返回延时 30s
            if (ocrDataList.length === 0) {
                logger.info('没有待处理的OCR数据，在' + config.OCR_PROCESSOR_DELAY + 'ms后重试');
                return config.OCR_PROCESSOR_DELAY; // 30秒
            }

            logger.info(`获取到 ${ocrDataList.length} 条待处理OCR数据`);

            // 3. 调用 aiProcessor 中的 processOcrDataList 对 ocrdata 进行信息提取
            const labReportResults = await this.aiProcessor.processOcrDataList(ocrDataList);
            
            // 4. 提取完成后将提取结果和输入的 ocrDataList 进行比对
            // 创建 OCR 数据 ID 到 OCR 数据的映射
            const ocrDataMap = new Map();
            ocrDataList.forEach(ocrData => {
                ocrDataMap.set(ocrData.id, ocrData);
            });

            // 处理每个 LabReport 结果
            for (const labReportData of labReportResults) {
                if (!labReportData || !labReportData.ocrdataId) {
                    logger.warn('LabReport数据缺少ocrdataId字段，跳过处理');
                    continue;
                }

                const ocrData = ocrDataMap.get(labReportData.ocrdataId);
                if (!ocrData) {
                    logger.warn(`未找到对应的OCR数据，ocrdataId: ${labReportData.ocrdataId}`);
                    continue;
                }

                try {
                    // 检查该 ocrdata 有没有被客户端删除
                    const stillExists = await OcrData.checkExists(ocrData.id);
                    
                    // 3a. 如果某个 ocrdata 完成了提取
                    if (stillExists) {
                        // 如果没有被删除，则根据提取结果生成 labreport 实例并保存到数据库中
                        const labReport = await LabReport.createWithItems(labReportData);
                        logger.info(`成功处理OCR数据 ${ocrData.id}，创建LabReport: ${labReport.id}`);
                        // 通知客户端
                        this.notifyLabReportCreated(labReport, ocrData);
                        // 同时将该条 ocrdata 数据在数据库中硬删除
                        await OcrData.hardDeleteBatch([ocrData.id]);
                        
                        processedCount++;
                    } else {
                        // 如果该 ocrdata 已经被客户端硬删除，则丢弃该提取结果
                        logger.info(`OCR数据 ${ocrData.id} 已被客户端删除，丢弃提取结果`);
                        skippedCount++;
                    }
                } catch (error) {
                    logger.error(`处理OCR数据 ${ocrData.id} 时发生错误, 作为未成功提取的数据做处理:`, error);
                    hasPartialFailure = true;
                }
            }

            // 处理未成功提取的 OCR 数据
            for (const ocrData of ocrDataList) {
                // 检查是否有对应的 LabReport 结果
                const hasLabReportResult = labReportResults.some(labReportData => 
                    labReportData && labReportData.ocrdataId === ocrData.id
                );

                if (!hasLabReportResult) {
                    // 3b. 如果某个 ocrdata 没有完成提取
                    try {
                        const stillExists = await OcrData.checkExists(ocrData.id);
                        if (stillExists) {
                            // 如果没有删除，那么将该条 ocrdata 在数据库还原，用于下一次提取
                            await OcrData.restore(ocrData.id);
                            logger.warn(`OCR数据 ${ocrData.id} 提取失败，已恢复等待下次重试`);
                            failedCount++;
                            hasPartialFailure = true;
                        } else {
                            // 如果删除了，则不处理
                            logger.info(`OCR数据 ${ocrData.id} 提取失败且已被删除，丢弃`);
                            skippedCount++;
                        }
                    } catch (error) {
                        logger.error(`处理未提取OCR数据 ${ocrData.id} 时发生错误，可能数据已经损坏，跳过:`, error);
                        skippedCount++;
                    }
                }
            }

            logger.info(`OCR处理任务完成 - 成功: ${processedCount}, 跳过: ${skippedCount}, 失败: ${failedCount}`);

            // 5. 在提取任务结束后，检查第#1步中所取出的 ocrdata 个数
            if (hasPartialFailure || ocrDataList.length === batchSize) {
                // 如果有部分失败，或者达到批次大小，则 ocrdata table 还有数据
                logger.info('OCR数据表还有数据，延时100ms继续提取');
                return config.OCR_PROCESSOR_IMMEDIATE_DELAY; // 100毫秒
            } else {
                // 如果完全成功并且没有达到批次大小，则认为 ocrdata table 已经被清空
                logger.info('OCR数据表已清空，延时30s进行信息提取');
                return config.OCR_PROCESSOR_DELAY; // 30秒
            }

        } catch (error) {
            logger.error('OCR处理任务失败:', error);
            
            // 批量恢复所有数据
            if (ocrDataList && ocrDataList.length > 0) {
                const restorePromises = ocrDataList.map(async (ocrData) => {
                    const stillExists = await OcrData.checkExists(ocrData.id);
                    if (stillExists) {
                        await OcrData.restore(ocrData.id);
                    }
                });
                
                await Promise.all(restorePromises);
                logger.info('处理失败，已恢复所有OCR数据');
            }
            
            return config.OCR_PROCESSOR_ERROR_RETRY_DELAY; // 错误重试延时
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 处理OCR数据批次（保持向后兼容）
     * @param {number} batchSize - 批次大小，默认5
     * @returns {Promise<Object>} 处理结果
     */
    async processBatch(batchSize = config.OCR_PROCESSOR_BATCH_SIZE) {
        const delay = await this.runTask(batchSize);
        
        return {
            success: true,
            message: 'OCR处理批次完成',
            nextDelay: delay,
            processedCount: 0, // 这些信息在 runTask 中已经记录到日志
            skippedCount: 0,
            failedCount: 0
        };
    }

    /**
     * 获取处理器状态
     * @returns {Object} 处理器状态信息
     */
    getStatus() {
        return {
            isProcessing: this.isProcessing
        };
    }

    /**
     * 手动触发处理（用于API调用）
     * @param {number} batchSize - 批次大小
     * @returns {Promise<Object>} 处理结果
     */
    async triggerProcessing(batchSize = config.OCR_PROCESSOR_BATCH_SIZE) {
        logger.info(`手动触发OCR处理，批次大小: ${batchSize}`);
        return await this.processBatch(batchSize);
    }

    async notifyLabReportCreated(labReport, ocrData) {
        try {
            const userId = await getUserIdFromLabReport(labReport);
            if (!userId) {
                logger.warn(`未找到LabReport对应的userId，labReportId: ${labReport.id}`);
                return;
            }

            // 检查WebSocket服务器是否可用
            if (!this.wsServer || typeof this.wsServer.sendMsgToUser !== 'function') {
                logger.warn(`WebSocket服务器不可用，跳过通知用户 ${userId}`);
                return;
            }

            const success = this.wsServer.sendMsgToUser(userId, {
                type: 'labReportCreated',
                labReportId: labReport.id,
                ocrDataId: ocrData.id,
                timestamp: new Date().toISOString()
            });

            if (success) {
                logger.info(`已向用户 ${userId} 发送LabReport创建通知`);
            } else {
                logger.warn(`用户 ${userId} 当前没有活跃连接，无法发送通知`);
            }
        } catch (error) {
            logger.warn(`发送WebSocket通知失败: ${error.message}`);
        }
    }
}

module.exports = { OcrProcessor }; 