const { sequelize } = require('../config/database');
const { User } = require('./user');
const { Workspace } = require('./workspace');
const { LabReport } = require('./labreport');
const { LabReportItem } = require('./labreportitem');
const { logger } = require('../config/logger');

class ModelManager {
    static async init() {
        try {
            logger.info('开始初始化数据库模型...');
            
            // 按依赖顺序初始化模型
            await User.init();
            await Workspace.init();
            await LabReport.init();
            await LabReportItem.init();
            
            // 定义关联关系
            User.model.hasMany(Workspace.model, {
                foreignKey: 'userId',
                as: 'workspaces',
                onDelete: 'CASCADE', // 用户删除时级联删除工作空间
                onUpdate: 'CASCADE'
            });
            
            Workspace.model.belongsTo(User.model, {
                foreignKey: 'userId',
                as: 'user'
            });
            
            // 工作空间与检验报告的关联关系
            Workspace.model.hasMany(LabReport.model, {
                foreignKey: 'workspaceId',
                as: 'labReports',
                onDelete: 'CASCADE', // 工作空间删除时级联删除检验报告
                onUpdate: 'CASCADE'
            });
            
            LabReport.model.belongsTo(Workspace.model, {
                foreignKey: 'workspaceId',
                as: 'workspace'
            });
            
            // 检验报告与检验报告项目的关联关系
            LabReport.model.hasMany(LabReportItem.model, {
                foreignKey: 'labReportId',
                as: 'labReportItems',
                onDelete: 'CASCADE', // 检验报告删除时级联删除检验报告项目
                onUpdate: 'CASCADE'
            });
            
            LabReportItem.model.belongsTo(LabReport.model, {
                foreignKey: 'labReportId',
                as: 'labReport'
            });
            
            // 同步数据库结构
            await sequelize.sync({ force: false });
            
            logger.info('所有模型初始化完成');
        } catch (error) {
            logger.error('模型初始化失败:', error);
            throw error;
        }
    }
    
    static async close() {
        try {
            await sequelize.close();
            logger.info('数据库连接已关闭');
        } catch (error) {
            logger.error('关闭数据库连接失败:', error);
        }
    }
    
    // 获取数据库连接状态
    static getConnectionStatus() {
        const pool = sequelize.connectionManager.pool;
        return {
            using: pool.using.length,
            idle: pool.idle.length,
            pending: pool.pending,
            max: pool.config.max,
            min: pool.config.min
        };
    }
}

module.exports = { ModelManager, sequelize }; 