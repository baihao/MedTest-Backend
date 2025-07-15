const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');

// 自定义错误类
class WorkspaceError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'WorkspaceError';
        this.statusCode = statusCode;
    }
}

class Workspace {
    constructor({ id, name, userId, createdAt }) {
        this.id = id;
        this.name = name;
        this.userId = userId;
        this.createdAt = createdAt || new Date();
    }

    static async init() {
        // 使用共享的数据库连接
        this.model = sequelize.define('Workspace', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                validate: {
                    len: [1, 100],
                    notEmpty: true
                }
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'user_id',
                references: {
                    model: 'users',
                    key: 'id'
                },
                validate: {
                    isInt: true,
                    min: 1
                }
            }
        }, {
            tableName: 'workspaces',
            timestamps: true,
            indexes: [
                {
                    fields: ['user_id']
                },
                {
                    unique: true,
                    fields: ['name', 'user_id'] // 同一用户不能有重名工作空间
                }
            ]
        });
    }

    // 数据验证方法
    static validateWorkspaceData(workspaceData) {
        const { name, userId } = workspaceData;
        
        if (!name || typeof name !== 'string') {
            throw new WorkspaceError('工作空间名称是必需的且必须是字符串');
        }
        
        if (name.trim().length === 0) {
            throw new WorkspaceError('工作空间名称不能为空');
        }
        
        if (name.length > 100) {
            throw new WorkspaceError('工作空间名称长度不能超过100个字符');
        }
        
        if (!userId || isNaN(Number(userId)) || Number(userId) < 1) {
            throw new WorkspaceError('用户ID是必需的且必须是正整数');
        }
    }

    static async create(workspaceData) {
        try {
            // 数据验证
            this.validateWorkspaceData(workspaceData);
            
            // 确保userId是数字类型
            const userId = Number(workspaceData.userId);
            if (isNaN(userId)) {
                throw new WorkspaceError('用户ID必须是有效的数字');
            }
            
            // 验证用户是否存在
            const { User } = require('./user');
            const user = await User.findById(userId);
            if (!user) {
                throw new WorkspaceError('指定的用户不存在', 404);
            }
            
            // 检查同一用户是否有重名工作空间
            const existingWorkspace = await this.model.findOne({
                where: {
                    name: workspaceData.name,
                    userId: userId
                }
            });
            
            if (existingWorkspace) {
                throw new WorkspaceError('该用户已存在同名工作空间', 409);
            }
            
            // 创建工作空间
            const dbWorkspace = await this.model.create({
                name: workspaceData.name,
                description: workspaceData.description || null,
                userId: userId
            });
            
            return new Workspace(dbWorkspace.toJSON());
        } catch (error) {
            if (error instanceof WorkspaceError) {
                throw error;
            }
            // 添加更详细的错误信息
            logger.error('工作空间创建错误详情:', error);
            throw new WorkspaceError(`创建工作空间失败: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new WorkspaceError('工作空间ID参数无效');
            }
            
            const workspace = await this.model.findByPk(id);
            return workspace ? new Workspace(workspace.toJSON()) : null;
        } catch (error) {
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError(`查找工作空间失败: ${error.message}`);
        }
    }

    static async findByUserId(userId) {
        try {
            if (!userId || isNaN(Number(userId))) {
                throw new WorkspaceError('用户ID参数无效');
            }
            
            const workspaces = await this.model.findAll({
                where: { userId: Number(userId) },
                order: [['createdAt', 'DESC']]
            });
            
            return workspaces.map(w => new Workspace(w.toJSON()));
        } catch (error) {
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError(`查找用户工作空间失败: ${error.message}`);
        }
    }

    static async update(id, updateData) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new WorkspaceError('工作空间ID参数无效');
            }
            
            // 检查工作空间是否存在
            const workspace = await this.findById(id);
            if (!workspace) {
                throw new WorkspaceError('工作空间不存在', 404);
            }
            
            // 验证更新数据
            if (updateData.name !== undefined) {
                if (!updateData.name || typeof updateData.name !== 'string') {
                    throw new WorkspaceError('工作空间名称是必需的且必须是字符串');
                }
                
                if (updateData.name.trim().length === 0) {
                    throw new WorkspaceError('工作空间名称不能为空');
                }
                
                if (updateData.name.length > 100) {
                    throw new WorkspaceError('工作空间名称长度不能超过100个字符');
                }
                
                // 检查重名
                const existingWorkspace = await this.model.findOne({
                    where: {
                        name: updateData.name,
                        userId: workspace.userId,
                        id: { [sequelize.Op.ne]: id }
                    }
                });
                
                if (existingWorkspace) {
                    throw new WorkspaceError('该用户已存在同名工作空间', 409);
                }
            }
            
            // 更新工作空间
            const [updatedCount] = await this.model.update(updateData, {
                where: { id }
            });
            
            if (updatedCount === 0) {
                throw new WorkspaceError('工作空间更新失败', 500);
            }
            
            // 返回更新后的工作空间
            return await this.findById(id);
        } catch (error) {
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError(`更新工作空间失败: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new WorkspaceError('工作空间ID参数无效');
            }
            
            // 检查工作空间是否存在
            const workspace = await this.findById(id);
            if (!workspace) {
                // 不抛异常，直接返回 false
                return false;
            }
            
            const result = await this.model.destroy({
                where: { id }
            });
            
            return result > 0;
        } catch (error) {
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError(`删除工作空间失败: ${error.message}`);
        }
    }

    // 批量操作
    static async createBatch(workspacesData) {
        const transaction = await sequelize.transaction();
        
        try {
            const createdWorkspaces = [];
            
            for (const workspaceData of workspacesData) {
                this.validateWorkspaceData(workspaceData);
                
                const workspace = await this.model.create(workspaceData, { transaction });
                createdWorkspaces.push(new Workspace(workspace.toJSON()));
            }
            
            await transaction.commit();
            return createdWorkspaces;
        } catch (error) {
            await transaction.rollback();
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError(`批量创建工作空间失败: ${error.message}`);
        }
    }

    // 统计方法
    static async countByUserId(userId) {
        try {
            if (!userId || isNaN(Number(userId))) {
                throw new WorkspaceError('用户ID参数无效');
            }
            
            return await this.model.count({
                where: { userId: Number(userId) }
            });
        } catch (error) {
            if (error instanceof WorkspaceError) {
                throw error;
            }
            throw new WorkspaceError(`统计用户工作空间失败: ${error.message}`);
        }
    }
}

module.exports = { Workspace, WorkspaceError };