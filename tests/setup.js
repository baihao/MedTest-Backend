const { ModelManager } = require('../models/modelmgr');
const { logger } = require('../config/logger');

// 全局测试设置
beforeAll(async () => {
    try {
        // 初始化数据库模型
        await ModelManager.init();
    } catch (error) {
        // 在测试环境中，如果数据库已经初始化，忽略错误
        logger.warn('数据库初始化警告:', error.message);
    }
});

// 每个测试前清理数据
beforeEach(async () => {
    try {
        // 清理所有表的数据
        const { sequelize } = require('../models/modelmgr');
        const { User } = require('../models/user');
        const { Workspace } = require('../models/workspace');
        const { LabReport } = require('../models/labreport');
        const { LabReportItem } = require('../models/labreportitem');
        
        // 按依赖关系顺序删除数据
        await LabReportItem.model.destroy({ where: {}, force: true });
        await LabReport.model.destroy({ where: {}, force: true });
        await Workspace.model.destroy({ where: {}, force: true });
        await User.model.destroy({ where: {}, force: true });
        
        // 重置自增ID
        await sequelize.query('DELETE FROM sqlite_sequence');
    } catch (error) {
        // 忽略清理错误，继续测试
        logger.warn('清理测试数据时忽略错误:', error.message);
    }
});

// 每个测试后清理数据
afterEach(async () => {
    try {
        // 清理所有表的数据
        const { sequelize } = require('../models/modelmgr');
        const { User } = require('../models/user');
        const { Workspace } = require('../models/workspace');
        const { LabReport } = require('../models/labreport');
        const { LabReportItem } = require('../models/labreportitem');
        
        // 按依赖关系顺序删除数据
        await LabReportItem.model.destroy({ where: {}, force: true });
        await LabReport.model.destroy({ where: {}, force: true });
        await Workspace.model.destroy({ where: {}, force: true });
        await User.model.destroy({ where: {}, force: true });
        
        // 重置自增ID
        await sequelize.query('DELETE FROM sqlite_sequence');
    } catch (error) {
        // 忽略清理错误
        logger.warn('最终清理时忽略错误:', error.message);
    }
});

// 全局测试清理
afterAll(async () => {
    try {
        // 关闭数据库连接
        await ModelManager.close();
    } catch (err) {
        logger.error('测试清理失败:', err);
    }
});