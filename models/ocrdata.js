const { DataTypes } = require('sequelize');
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
        }, {
            tableName: 'ocr_data',
            timestamps: true,
            createdAt: 'createdAt',
            updatedAt: 'updatedAt'
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

    // 批量获取OCR数据
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

    // 批量删除OCR数据
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

    // 根据工作空间ID查找OCR数据
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
}

module.exports = { OcrData, OcrDataError }; 