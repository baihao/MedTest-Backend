const { Sequelize } = require('sequelize');
const path = require('path');
const { logger } = require('./logger');

// 数据库配置
const dbPath = path.join(__dirname, '../database.db');

// 创建 Sequelize 实例
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false, // 关闭 SQL 日志
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// 测试数据库连接
async function testConnection() {
    try {
        await sequelize.authenticate();
        logger.info('数据库连接成功');
    } catch (error) {
        logger.error('连接验证失败:', error.message);
        throw error;
    }
}

// 获取数据库连接
async function getConnection() {
    try {
        logger.debug('正在获取数据库连接...');
        const connection = await sequelize.getConnection();
        logger.debug('数据库连接已建立');
        return connection;
    } catch (err) {
        logger.error('数据库连接失败:', err);
        throw err;
    }
}

// 初始化数据库
async function initDatabase() {
    try {
        await testConnection();
        logger.info('数据库初始化完成');
    } catch (error) {
        logger.error('数据库初始化失败:', error);
        throw error;
    }
}

module.exports = {
    sequelize,
    testConnection,
    getConnection,
    initDatabase
}; 