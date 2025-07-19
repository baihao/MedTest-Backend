const { OcrData } = require('../models/ocrdata');
const { LabReport } = require('../models/labreport');
const logger = require('../config/logger');

class OcrProcessor {
    constructor() {
        this.isProcessing = false;
        this.processingInterval = null;
    }

    /**
     * 处理OCR数据批次
     * @param {number} batchSize - 批次大小，默认50
     * @returns {Promise<Object>} 处理结果
     */
    async processBatch(batchSize = 50) {
        if (this.isProcessing) {
            logger.warn('OCR处理器正在运行中，跳过本次处理');
            return {
                success: false,
                message: 'OCR处理器正在运行中',
                processedCount: 0,
                skippedCount: 0,
                failedCount: 0
            };
        }

        this.isProcessing = true;
        let processedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        try {
            logger.info(`开始OCR处理批次，批次大小: ${batchSize}`);

            // 获取并软删除待处理数据
            const ocrDataList = await OcrData.getAndSoftDelete(batchSize);
            
            if (ocrDataList.length === 0) {
                logger.info('没有待处理的OCR数据');
                return {
                    success: true,
                    message: '没有待处理的OCR数据',
                    processedCount: 0,
                    skippedCount: 0,
                    failedCount: 0
                };
            }

            logger.info(`获取到 ${ocrDataList.length} 条待处理OCR数据`);

            // 批量处理所有数据
            const batchResult = await this.processOcrDataBatch(ocrDataList);
            processedCount = batchResult.processedCount;
            skippedCount = batchResult.skippedCount;
            failedCount = batchResult.failedCount;

            logger.info(`OCR处理批次完成 - 成功: ${processedCount}, 跳过: ${skippedCount}, 失败: ${failedCount}`);

            return {
                success: true,
                message: 'OCR处理批次完成',
                processedCount,
                skippedCount,
                failedCount,
                totalCount: ocrDataList.length
            };

        } catch (error) {
            logger.error('OCR处理批次失败:', error);
            return {
                success: false,
                message: 'OCR处理批次失败: ' + error.message,
                processedCount,
                skippedCount,
                failedCount,
                error: error.message
            };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 批量处理OCR数据
     * @param {Array} ocrDataBatch - OCR数据数组
     * @returns {Promise<Object>} 处理结果
     */
    async processOcrDataBatch(ocrDataBatch) {
        let processedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        try {
            // 过滤出仍然存在的数据（未被客户端硬删除）
            const existingData = [];
            const nonExistingIds = [];

            for (const ocrData of ocrDataBatch) {
                const stillExists = await OcrData.checkExists(ocrData.id);
                if (stillExists) {
                    existingData.push(ocrData);
                } else {
                    nonExistingIds.push(ocrData.id);
                    skippedCount++;
                }
            }

            if (nonExistingIds.length > 0) {
                logger.info(`跳过已被删除的OCR数据: ${nonExistingIds.join(', ')}`);
            }

            if (existingData.length === 0) {
                logger.info('当前批次中没有有效的OCR数据');
                return { processedCount: 0, skippedCount, failedCount: 0 };
            }

            // 批量调用大模型处理
            const labReportResults = await this.extractLabReportsFromOcrBatch(existingData);
            
            // 处理结果
            for (let i = 0; i < existingData.length; i++) {
                const ocrData = existingData[i];
                const labReportData = labReportResults[i];

                try {
                    if (labReportData) {
                        // 再次检查数据是否存在（处理过程中可能被删除）
                        const stillExistsAfterProcessing = await OcrData.checkExists(ocrData.id);
                        
                        if (stillExistsAfterProcessing) {
                            // 创建LabReport
                            await LabReport.createWithItems(labReportData);
                            logger.info(`成功处理OCR数据 ${ocrData.id}，创建LabReport`);
                            
                            // 硬删除OCR数据（处理完成）
                            await OcrData.hardDeleteBatch([ocrData.id]);
                            
                            processedCount++;
                        } else {
                            logger.info(`OCR数据 ${ocrData.id} 在处理完成后被删除，丢弃处理结果`);
                            skippedCount++;
                        }
                    } else {
                        // 处理失败，检查数据是否仍然存在
                        const stillExistsAfterFailure = await OcrData.checkExists(ocrData.id);
                        
                        if (stillExistsAfterFailure) {
                            // 恢复数据，下次重试
                            await OcrData.restore(ocrData.id);
                            logger.warn(`OCR数据 ${ocrData.id} 处理失败，已恢复等待下次重试`);
                            failedCount++;
                        } else {
                            logger.info(`OCR数据 ${ocrData.id} 处理失败且已被删除，丢弃`);
                            skippedCount++;
                        }
                    }
                } catch (error) {
                    logger.error(`处理OCR数据 ${ocrData.id} 时发生错误:`, error);
                    
                    // 错误处理：检查数据是否存在，决定是否恢复
                    const stillExists = await OcrData.checkExists(ocrData.id);
                    if (stillExists) {
                        await OcrData.restore(ocrData.id);
                        logger.info(`OCR数据 ${ocrData.id} 处理出错，已恢复等待下次重试`);
                        failedCount++;
                    } else {
                        skippedCount++;
                    }
                }
            }

            return { processedCount, skippedCount, failedCount };

        } catch (error) {
            logger.error('批量处理OCR数据失败:', error);
            
            // 批量恢复所有数据
            const restorePromises = ocrDataBatch.map(async (ocrData) => {
                const stillExists = await OcrData.checkExists(ocrData.id);
                if (stillExists) {
                    await OcrData.restore(ocrData.id);
                }
            });
            
            await Promise.all(restorePromises);
            logger.info('批量处理失败，已恢复所有OCR数据');
            
            return { processedCount: 0, skippedCount, failedCount: ocrDataBatch.length };
        }
    }

    /**
     * 批量调用大模型提取LabReport信息
     * @param {Array} ocrDataBatch - OCR数据数组
     * @returns {Promise<Array>} 提取的LabReport数据数组
     */
    async extractLabReportsFromOcrBatch(ocrDataBatch) {
        try {
            logger.debug(`开始批量提取LabReport信息，OCR数据数量: ${ocrDataBatch.length}`);

            // 批量调用大模型API
            const extractedDataArray = await this.callLargeModelBatch(ocrDataBatch);
            
            // 验证和转换结果
            const labReportDataArray = [];
            
            for (let i = 0; i < ocrDataBatch.length; i++) {
                const ocrData = ocrDataBatch[i];
                const extractedData = extractedDataArray[i];
                
                if (!extractedData) {
                    logger.warn(`大模型未返回有效数据，OCR数据ID: ${ocrData.id}`);
                    labReportDataArray.push(null);
                    continue;
                }

                // 验证提取的数据
                if (!extractedData.patient || !extractedData.items || extractedData.items.length === 0) {
                    logger.warn(`大模型返回的数据不完整，OCR数据ID: ${ocrData.id}`);
                    labReportDataArray.push(null);
                    continue;
                }

                const labReportData = {
                    patient: extractedData.patient,
                    reportTime: extractedData.reportTime || new Date(),
                    doctor: extractedData.doctor || '未知医生',
                    reportImage: ocrData.reportImage,
                    hospital: extractedData.hospital || '未知医院',
                    workspaceId: ocrData.workspaceId,
                    items: extractedData.items || []
                };

                labReportDataArray.push(labReportData);
                logger.debug(`成功提取LabReport信息，OCR数据ID: ${ocrData.id}, 患者: ${labReportData.patient}`);
            }

            return labReportDataArray;

        } catch (error) {
            logger.error(`批量提取LabReport信息失败:`, error);
            return new Array(ocrDataBatch.length).fill(null);
        }
    }

    /**
     * 批量调用大模型API（示例实现）
     * @param {Array} ocrDataBatch - OCR数据数组
     * @returns {Promise<Array>} 大模型返回的提取结果数组
     */
    async callLargeModelBatch(ocrDataBatch) {
        try {
            logger.debug(`批量调用大模型API，处理 ${ocrDataBatch.length} 条OCR数据`);

            // 模拟处理延迟
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 模拟批量大模型API调用
            // 这里应该替换为实际的大模型API批量调用
            // 例如：OpenAI GPT、Claude、通义千问等
            
            const results = [];
            
            for (const ocrData of ocrDataBatch) {
                // 模拟提取结果
                const extractedData = {
                    patient: `患者${ocrData.id}`,
                    reportTime: new Date(),
                    doctor: '李医生',
                    hospital: '测试医院',
                    items: [
                        {
                            itemName: '血常规',
                            result: '正常',
                            unit: 'g/L',
                            referenceValue: '3.5-5.5'
                        },
                        {
                            itemName: '尿常规',
                            result: '正常',
                            unit: 'g/L',
                            referenceValue: '3.5-5.5'
                        }
                    ]
                };

                // 模拟90%的成功率
                if (Math.random() < 0.9) {
                    results.push(extractedData);
                } else {
                    logger.warn(`大模型API调用失败（模拟），OCR数据ID: ${ocrData.id}`);
                    results.push(null);
                }
            }

            return results;

        } catch (error) {
            logger.error('批量调用大模型API失败:', error);
            return new Array(ocrDataBatch.length).fill(null);
        }
    }

    /**
     * 启动定时处理
     * @param {number} intervalMinutes - 处理间隔（分钟），默认5分钟
     */
    startScheduledProcessing(intervalMinutes = 5) {
        if (this.processingInterval) {
            logger.warn('OCR定时处理已在运行中');
            return;
        }

        logger.info(`启动OCR定时处理，间隔 ${intervalMinutes} 分钟`);
        
        // 立即执行一次
        this.processBatch();
        
        // 设置定时器
        this.processingInterval = setInterval(() => {
            this.processBatch();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * 停止定时处理
     */
    stopScheduledProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            logger.info('OCR定时处理已停止');
        } else {
            logger.warn('OCR定时处理未在运行');
        }
    }

    /**
     * 获取处理器状态
     * @returns {Object} 处理器状态信息
     */
    getStatus() {
        return {
            isProcessing: this.isProcessing,
            isScheduled: this.processingInterval !== null,
            processingInterval: this.processingInterval ? 'running' : 'stopped'
        };
    }

    /**
     * 手动触发处理（用于API调用）
     * @param {number} batchSize - 批次大小
     * @returns {Promise<Object>} 处理结果
     */
    async triggerProcessing(batchSize = 50) {
        logger.info(`手动触发OCR处理，批次大小: ${batchSize}`);
        return await this.processBatch(batchSize);
    }
}

module.exports = { OcrProcessor }; 