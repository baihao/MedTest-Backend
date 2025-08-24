const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');

// 自定义错误类
class LabReportItemError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'LabReportItemError';
        this.statusCode = statusCode;
    }
}

class LabReportItem {
    constructor({ id, labReportId, itemName, result, unit, referenceValue, createdAt, updatedAt }) {
        this.id = id;
        this.labReportId = labReportId;
        this.itemName = itemName;
        this.result = result;
        this.unit = unit;
        this.referenceValue = referenceValue;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    static async init() {
        // 使用共享的数据库连接
        this.model = sequelize.define('LabReportItem', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            labReportId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'lab_report_id',
                references: {
                    model: 'lab_reports',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                validate: {
                    isInt: true,
                    min: 1
                }
            },
            itemName: {
                type: DataTypes.STRING(200),
                allowNull: false,
                field: 'item_name',
                validate: {
                    len: [1, 200],
                    notEmpty: true
                }
            },
            result: {
                type: DataTypes.STRING(500),
                allowNull: false,
                validate: {
                    len: [1, 500],
                    notEmpty: true
                }
            },
            unit: {
                type: DataTypes.STRING(50),
                allowNull: true,
                validate: {
                    len: [0, 50]
                }
            },
            referenceValue: {
                type: DataTypes.STRING(200),
                allowNull: true,
                field: 'reference_value',
                validate: {
                    len: [0, 200]
                }
            }
        }, {
            tableName: 'lab_report_items',
            timestamps: true,
            indexes: [
                {
                    fields: ['lab_report_id']
                },
                {
                    fields: ['item_name']
                },
                {
                    fields: ['lab_report_id', 'item_name']
                }
            ]
        });
    }

    // 数据验证方法
    static validateLabReportItemData(labReportItemData) {
        const { labReportId, itemName, result, unit, referenceValue } = labReportItemData;
        
        if (!labReportId || isNaN(Number(labReportId)) || Number(labReportId) < 1) {
            throw new LabReportItemError('检验报告ID是必需的且必须是正整数');
        }
        
        if (!itemName || typeof itemName !== 'string') {
            throw new LabReportItemError('项目名称是必需的且必须是字符串');
        }
        
        if (itemName.trim().length === 0) {
            throw new LabReportItemError('项目名称不能为空');
        }
        
        if (itemName.length > 200) {
            throw new LabReportItemError('项目名称长度不能超过200个字符');
        }
        
        if (!result || typeof result !== 'string') {
            throw new LabReportItemError('检验结果是必需的且必须是字符串');
        }
        
        if (result.trim().length === 0) {
            throw new LabReportItemError('检验结果不能为空');
        }
        
        if (result.length > 500) {
            throw new LabReportItemError('检验结果长度不能超过500个字符');
        }
        
        if (unit !== undefined && unit !== null) {
            if (typeof unit !== 'string') {
                throw new LabReportItemError('单位必须是字符串');
            }
            
            if (unit.length > 50) {
                throw new LabReportItemError('单位长度不能超过50个字符');
            }
        }
        
        if (referenceValue !== undefined && referenceValue !== null) {
            if (typeof referenceValue !== 'string') {
                throw new LabReportItemError('参考值必须是字符串');
            }
            
            if (referenceValue.length > 200) {
                throw new LabReportItemError('参考值长度不能超过200个字符');
            }
        }
    }

    // 创建检验报告项目
    static async create(labReportItemData) {
        try {
            // 数据验证
            this.validateLabReportItemData(labReportItemData);
            
            // 确保labReportId是数字类型
            const labReportId = Number(labReportItemData.labReportId);
            if (isNaN(labReportId)) {
                throw new LabReportItemError('检验报告ID必须是有效的数字');
            }
            
            // 验证检验报告是否存在
            const { LabReport } = require('./labreport');
            const labReport = await LabReport.findById(labReportId);
            if (!labReport) {
                throw new LabReportItemError('指定的检验报告不存在', 404);
            }
            
            // 创建检验报告项目
            const dbLabReportItem = await this.model.create({
                labReportId: labReportId,
                itemName: labReportItemData.itemName,
                result: labReportItemData.result,
                unit: labReportItemData.unit || null,
                referenceValue: labReportItemData.referenceValue || null
            });
            
            return new LabReportItem(dbLabReportItem.toJSON());
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`创建检验报告项目失败: ${error.message}`);
        }
    }

    // 根据ID查找检验报告项目
    static async findById(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new LabReportItemError('检验报告项目ID参数无效');
            }
            
            const labReportItem = await this.model.findByPk(id);
            return labReportItem ? new LabReportItem(labReportItem.toJSON()) : null;
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`查找检验报告项目失败: ${error.message}`);
        }
    }

    // 根据检验报告ID查找所有项目
    static async findByLabReportId(labReportId, itemNames = null) {
        try {
            if (!labReportId || isNaN(Number(labReportId))) {
                throw new LabReportItemError('检验报告ID参数无效');
            }
            
            const whereClause = { labReportId: Number(labReportId) };
            
            // 如果提供了itemNames，添加过滤条件
            if (itemNames && Array.isArray(itemNames) && itemNames.length > 0) {
                whereClause.itemName = {
                    [Op.in]: itemNames
                };
            }
            
            const items = await this.model.findAll({
                where: whereClause,
                order: [['createdAt', 'ASC']]
            });
            
            return items.map(item => new LabReportItem(item.toJSON()));
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`查找检验报告项目失败: ${error.message}`);
        }
    }

    // 根据项目名称查找
    static async findByItemName(itemName, labReportId = null) {
        try {
            if (!itemName || typeof itemName !== 'string') {
                throw new LabReportItemError('项目名称参数无效');
            }
            
            const whereClause = { itemName };
            if (labReportId) {
                whereClause.labReportId = Number(labReportId);
            }
            
            const items = await this.model.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']]
            });
            
            return items.map(item => new LabReportItem(item.toJSON()));
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`根据项目名称查找失败: ${error.message}`);
        }
    }

    // 统计检验报告的项目数量
    static async countByLabReportId(labReportId) {
        try {
            if (!labReportId || isNaN(Number(labReportId))) {
                throw new LabReportItemError('检验报告ID参数无效');
            }
            
            return await this.model.count({
                where: { labReportId: Number(labReportId) }
            });
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`统计检验报告项目失败: ${error.message}`);
        }
    }

    // 更新检验报告项目
    static async update(id, updateData) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new LabReportItemError('检验报告项目ID参数无效');
            }
            
            // 检查项目是否存在
            const item = await this.findById(id);
            if (!item) {
                throw new LabReportItemError('检验报告项目不存在', 404);
            }
            
            // 验证更新数据
            if (updateData.itemName !== undefined) {
                if (!updateData.itemName || typeof updateData.itemName !== 'string') {
                    throw new LabReportItemError('项目名称是必需的且必须是字符串');
                }
                
                if (updateData.itemName.trim().length === 0) {
                    throw new LabReportItemError('项目名称不能为空');
                }
                
                if (updateData.itemName.length > 200) {
                    throw new LabReportItemError('项目名称长度不能超过200个字符');
                }
            }
            
            if (updateData.result !== undefined) {
                if (!updateData.result || typeof updateData.result !== 'string') {
                    throw new LabReportItemError('检验结果是必需的且必须是字符串');
                }
                
                if (updateData.result.trim().length === 0) {
                    throw new LabReportItemError('检验结果不能为空');
                }
                
                if (updateData.result.length > 500) {
                    throw new LabReportItemError('检验结果长度不能超过500个字符');
                }
            }
            
            // 更新项目
            const [updatedCount] = await this.model.update(updateData, {
                where: { id }
            });
            
            if (updatedCount === 0) {
                throw new LabReportItemError('检验报告项目更新失败', 500);
            }
            
            // 返回更新后的项目
            return await this.findById(id);
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`更新检验报告项目失败: ${error.message}`);
        }
    }

    // 删除检验报告项目
    static async delete(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new LabReportItemError('检验报告项目ID参数无效');
            }
            
            // 检查项目是否存在
            const item = await this.findById(id);
            if (!item) {
                return false;
            }
            
            const result = await this.model.destroy({
                where: { id }
            });
            
            return result > 0;
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`删除检验报告项目失败: ${error.message}`);
        }
    }

    // 根据检验报告ID删除所有相关项目
    static async deleteByLabReportId(labReportId) {
        try {
            if (!labReportId || isNaN(Number(labReportId))) {
                throw new LabReportItemError('检验报告ID参数无效');
            }
            
            const result = await this.model.destroy({
                where: { labReportId: Number(labReportId) }
            });
            
            return result > 0;
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`删除检验报告项目失败: ${error.message}`);
        }
    }

    // 批量创建检验报告项目
    static async createBatch(labReportItemsData, externalTransaction = null) {
        const transaction = externalTransaction || await sequelize.transaction();
        const shouldCommit = !externalTransaction; // 只有内部创建的事务才需要提交
        
        try {
            const createdItems = [];
            
            for (const itemData of labReportItemsData) {
                this.validateLabReportItemData(itemData);
                
                const item = await this.model.create({
                    labReportId: Number(itemData.labReportId),
                    itemName: itemData.itemName,
                    result: itemData.result,
                    unit: itemData.unit || null,
                    referenceValue: itemData.referenceValue || null
                }, { transaction });
                
                createdItems.push(new LabReportItem(item.toJSON()));
            }
            
            if (shouldCommit) {
                await transaction.commit();
            }
            return createdItems;
        } catch (error) {
            if (shouldCommit) {
                await transaction.rollback();
            }
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`批量创建检验报告项目失败: ${error.message}`);
        }
    }

    // 获取工作空间下所有报告项目名称
    static async getItemNamesByWorkspace(workspaceId) {
        try {
            if (!workspaceId || isNaN(Number(workspaceId))) {
                throw new LabReportItemError('工作空间ID参数无效');
            }
            
            const rows = await this.model.findAll({
                include: [{
                    model: sequelize.models.LabReport,
                    as: 'labReport',
                    where: { workspaceId: Number(workspaceId) },
                    attributes: []
                }],
                attributes: ['itemName'],
                group: ['itemName'],
                order: [['itemName', 'ASC']]
            });
            
            return rows.map(row => row.itemName);
        } catch (error) {
            if (error instanceof LabReportItemError) {
                throw error;
            }
            throw new LabReportItemError(`获取工作空间报告项目名称失败: ${error.message}`);
        }
    }
}

module.exports = { LabReportItem, LabReportItemError }; 