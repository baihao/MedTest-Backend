const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

class OcrDataError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'OcrDataError';
        this.statusCode = statusCode;
    }
}

class OcrData {
    constructor(data) {
        this.id = data.id;
        this.reportImage = data.reportImage;
        this.ocrPrimitive = data.ocrPrimitive;
        this.workspaceId = data.workspaceId;
        this.deletedAt = data.deletedAt; // 添加 deletedAt 字段
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    static async init() {
        this.model = sequelize.define('OcrData', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            reportImage: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: '报告图片路径或URL'
            },
            ocrPrimitive: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: 'OCR原始识别结果'
            },
            workspaceId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'workspaces',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            }
            // 移除 deletedAt 字段定义，让 Sequelize 自动处理
        }, {
            tableName: 'ocr_data',
            timestamps: true,
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
            paranoid: true, // 启用软删除，Sequelize 会自动添加 deletedAt 字段
            deletedAt: 'deletedAt'
        });
    }

    // 数据验证
    static validateOcrData(data) {
        if (!data.reportImage || typeof data.reportImage !== 'string' || data.reportImage.trim() === '') {
            throw new OcrDataError('报告图片路径是必需的且不能为空');
        }

        if (!data.ocrPrimitive || typeof data.ocrPrimitive !== 'string' || data.ocrPrimitive.trim() === '') {
            throw new OcrDataError('OCR原始识别结果是必需的且不能为空');
        }

        if (!data.workspaceId || isNaN(Number(data.workspaceId))) {
            throw new OcrDataError('工作空间ID是必需的且必须是有效的数字');
        }
    }

    // 创建单个OCR数据
    static async create(ocrData) {
        try {
            this.validateOcrData(ocrData);
            
            const workspaceId = Number(ocrData.workspaceId);
            
            // 验证工作空间是否存在
            const { Workspace } = require('./workspace');
            const workspace = await Workspace.findById(workspaceId);
            if (!workspace) {
                throw new OcrDataError('指定的工作空间不存在', 404);
            }

            const dbOcrData = await this.model.create({
                reportImage: ocrData.reportImage.trim(),
                ocrPrimitive: ocrData.ocrPrimitive.trim(),
                workspaceId: workspaceId
            });

            return new OcrData(dbOcrData.toJSON());
        } catch (error) {
            if (error instanceof OcrDataError) {
                throw error;
            }
            logger.error('创建OCR数据失败:', error);
            throw new OcrDataError('创建OCR数据失败: ' + error.message);
        }
    }

    // 批量创建OCR数据
    static async createBatch(ocrDataArray, externalTransaction = null) {
        const transaction = externalTransaction || await sequelize.transaction();
        const shouldCommit = !externalTransaction;
        
        try {
            const createdOcrData = [];

            if (!ocrDataArray || !Array.isArray(ocrDataArray) || ocrDataArray.length === 0) {
                throw new OcrDataError('OCR数据数组是必需的且不能为空');
            }

            for (const ocrData of ocrDataArray) {
                this.validateOcrData(ocrData);
                
                const workspaceId = Number(ocrData.workspaceId);
                
                // 验证工作空间是否存在
                const { Workspace } = require('./workspace');
                const workspace = await Workspace.findById(workspaceId);
                if (!workspace) {
                    throw new OcrDataError(`工作空间ID ${workspaceId} 不存在`, 404);
                }

                const dbOcrData = await this.model.create({
                    reportImage: ocrData.reportImage.trim(),
                    ocrPrimitive: ocrData.ocrPrimitive.trim(),
                    workspaceId: workspaceId
                }, { transaction });

                createdOcrData.push(new OcrData(dbOcrData.toJSON()));
            }

            if (shouldCommit) {
                await transaction.commit();
            }

            return createdOcrData;
        } catch (error) {
            if (shouldCommit) {
                await transaction.rollback();
            }
            if (error instanceof OcrDataError) {
                throw error;
            }
            logger.error('批量创建OCR数据失败:', error);
            throw new OcrDataError('批量创建OCR数据失败: ' + error.message);
        }
    }

    // 批量获取OCR数据（保持向后兼容）
    static async getBatch(maxBatchSize = 100) {
        try {
            if (!maxBatchSize || isNaN(Number(maxBatchSize)) || Number(maxBatchSize) <= 0) {
                throw new OcrDataError('最大批次大小必须是正整数');
            }

            const limit = Math.min(Number(maxBatchSize), 1000); // 限制最大值为1000

            const dbOcrDataArray = await this.model.findAll({
                limit: limit,
                order: [['createdAt', 'ASC']]
            });

            return dbOcrDataArray.map(ocrData => new OcrData(ocrData.toJSON()));
        } catch (error) {
            if (error instanceof OcrDataError) {
                throw error;
            }
            logger.error('批量获取OCR数据失败:', error);
            throw new OcrDataError('批量获取OCR数据失败: ' + error.message);
        }
    }

    // 批量删除OCR数据（保持向后兼容，用于API）
    static async deleteBatch(idArray, externalTransaction = null) {
        const transaction = externalTransaction || await sequelize.transaction();
        const shouldCommit = !externalTransaction;
        
        try {
            if (!idArray || !Array.isArray(idArray) || idArray.length === 0) {
                throw new OcrDataError('ID数组是必需的且不能为空');
            }

            // 验证所有ID都是有效的数字
            const validIds = idArray.filter(id => !isNaN(Number(id)) && Number(id) > 0);
            if (validIds.length !== idArray.length) {
                throw new OcrDataError('所有ID必须是有效的正整数');
            }

            const numericIds = validIds.map(id => Number(id));

            // 检查要删除的记录是否存在
            const existingRecords = await this.model.findAll({
                where: { id: numericIds },
                transaction
            });

            if (existingRecords.length !== numericIds.length) {
                const existingIds = existingRecords.map(record => record.id);
                const missingIds = numericIds.filter(id => !existingIds.includes(id));
                throw new OcrDataError(`以下ID的记录不存在: ${missingIds.join(', ')}`, 404);
            }

            // 执行批量删除
            const deletedCount = await this.model.destroy({
                where: { id: numericIds },
                transaction
            });

            if (shouldCommit) {
                await transaction.commit();
            }

            return {
                deletedCount: deletedCount,
                deletedIds: numericIds
            };
        } catch (error) {
            if (shouldCommit) {
                await transaction.rollback();
            }
            if (error instanceof OcrDataError) {
                throw error;
            }
            logger.error('批量删除OCR数据失败:', error);
            throw new OcrDataError('批量删除OCR数据失败: ' + error.message);
        }
    }

    // 根据ID查找OCR数据
    static async findById(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new OcrDataError('ID必须是有效的数字');
            }

            const dbOcrData = await this.model.findByPk(Number(id));
            if (!dbOcrData) {
                return null;
            }

            return new OcrData(dbOcrData.toJSON());
        } catch (error) {
            if (error instanceof OcrDataError) {
                throw error;
            }
            logger.error('根据ID查找OCR数据失败:', error);
            throw new OcrDataError('根据ID查找OCR数据失败: ' + error.message);
        }
    }

    // 根据工作空间ID查找OCR数据（排除已删除的）
    static async findByWorkspaceId(workspaceId, limit = 100, offset = 0) {
        try {
            if (!workspaceId || isNaN(Number(workspaceId))) {
                throw new OcrDataError('工作空间ID必须是有效的数字');
            }

            const dbOcrDataArray = await this.model.findAll({
                where: { workspaceId: Number(workspaceId) },
                limit: Math.min(limit, 1000),
                offset: Math.max(offset, 0),
                order: [['createdAt', 'DESC']]
            });

            return dbOcrDataArray.map(ocrData => new OcrData(ocrData.toJSON()));
        } catch (error) {
            if (error instanceof OcrDataError) {
                throw error;
            }
            logger.error('根据工作空间ID查找OCR数据失败:', error);
            throw new OcrDataError('根据工作空间ID查找OCR数据失败: ' + error.message);
        }
    }

    // 获取待处理数据并软删除（优化版本，使用 Sequelize 标准方法）
    static async getAndSoftDelete(batchSize = 50) {
        const transaction = await sequelize.transaction();
        
        try {
            // 获取待处理数据（使用默认的 paranoid 行为，只获取未删除的数据）
            const pendingData = await this.model.findAll({
                limit: batchSize,
                order: [['createdAt', 'ASC']],
                transaction
            });

            if (pendingData.length === 0) {
                await transaction.commit();
                return [];
            }

            // 使用 Sequelize 标准的软删除方法
            const ids = pendingData.map(item => item.id);
            const deletedCount = await this.model.destroy({
                where: { id: ids },
                transaction
            });

            // 如果删除数量不匹配，说明有并发冲突
            if (deletedCount !== pendingData.length) {
                await transaction.rollback();
                logger.warn(`乐观锁冲突：期望删除 ${pendingData.length} 条，实际删除 ${deletedCount} 条，重试中...`);
                // 递归重试
                return await this.getAndSoftDelete(batchSize);
            }

            await transaction.commit();
            return pendingData.map(data => new OcrData(data.toJSON()));

        } catch (error) {
            await transaction.rollback();
            logger.error('获取并软删除OCR数据失败:', error);
            throw new OcrDataError('获取并软删除OCR数据失败: ' + error.message);
        }
    }

    // 原子化的硬删除（客户端删除操作）
    static async hardDeleteBatch(idArray, externalTransaction = null) {
        const transaction = externalTransaction || await sequelize.transaction();
        const shouldCommit = !externalTransaction;
        
        try {
            if (!idArray || !Array.isArray(idArray) || idArray.length === 0) {
                throw new OcrDataError('ID数组是必需的且不能为空');
            }

            const validIds = idArray.filter(id => !isNaN(Number(id)) && Number(id) > 0);
            if (validIds.length !== idArray.length) {
                throw new OcrDataError('所有ID必须是有效的正整数');
            }

            // 硬删除（包括软删除的数据）
            const deletedCount = await this.model.destroy({
                where: { id: validIds },
                force: true, // 强制硬删除
                transaction
            });

            if (shouldCommit) {
                await transaction.commit();
            }

            return {
                deletedCount: deletedCount,
                deletedIds: validIds
            };
        } catch (error) {
            if (shouldCommit) {
                await transaction.rollback();
            }
            if (error instanceof OcrDataError) {
                throw error;
            }
            logger.error('硬删除OCR数据失败:', error);
            throw new OcrDataError('硬删除OCR数据失败: ' + error.message);
        }
    }

    // 原子化的恢复操作（处理失败时）
    static async restore(id) {
        const transaction = await sequelize.transaction();
        
        try {
            // 检查数据是否存在且已软删除
            const data = await this.model.findByPk(id, { 
                paranoid: false,
                transaction 
            });

            if (!data) {
                await transaction.commit();
                logger.warn(`OCR数据 ${id} 不存在，无法恢复`);
                return false;
            }

            if (!data.deletedAt) {
                await transaction.commit();
                logger.info(`OCR数据 ${id} 未被删除，无需恢复`);
                return true;
            }

            // 使用 Sequelize 的 restore 方法恢复数据
            await data.restore({ transaction });

            await transaction.commit();
            logger.info(`恢复OCR数据 ${id}`);
            return true;

        } catch (error) {
            await transaction.rollback();
            logger.error(`恢复OCR数据 ${id} 失败:`, error);
            return false;
        }
    }

    // 原子化的存在性检查
    static async checkExists(id) {
        try {
            const data = await this.model.findByPk(id, { paranoid: false });
            return data !== null;
        } catch (error) {
            logger.error('检查OCR数据存在性失败:', error);
            return false;
        }
    }

    // 获取处理统计信息（优化版本）
    static async getProcessingStats() {
        try {
            const result = {
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0
            };

            // 统计未删除的数据（待处理）- 使用默认的 paranoid 行为
            const pendingCount = await this.model.count();

            // 统计软删除的数据（处理中）- 使用 paranoid: false
            const processingCount = await this.model.count({
                paranoid: false,
                where: { 
                    deletedAt: { [Op.not]: null }
                }
            });

            result.pending = pendingCount;
            result.processing = processingCount;

            return result;
        } catch (error) {
            logger.error('获取处理统计信息失败:', error);
            throw new OcrDataError('获取处理统计信息失败: ' + error.message);
        }
    }
}

module.exports = { OcrData, OcrDataError }; 