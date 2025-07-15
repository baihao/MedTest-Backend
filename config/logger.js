const pino = require('pino');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 创建 pino logger 配置
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: process.env.NODE_ENV === 'production' ? {
        targets: [
            // 主日志文件 - 按日期轮换
            {
                target: 'pino-roll',
                options: {
                    file: path.join(logDir, 'app.log'),
                    frequency: 'daily',
                    mkdir: true,
                    size: '10m', // 单个文件最大 10MB
                    limit: {
                        count: 30 // 保留 30 天的日志
                    }
                }
            },
            // 错误日志单独文件
            {
                target: 'pino-roll',
                options: {
                    file: path.join(logDir, 'error.log'),
                    frequency: 'daily',
                    mkdir: true,
                    size: '10m',
                    limit: {
                        count: 30
                    }
                },
                level: 'error'
            }
        ]
    } : {
        // 开发环境美化输出
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg}'
        }
    }
});

// 导出兼容原有接口的函数
const info = (...params) => {
    if (params.length === 1 && typeof params[0] === 'string') {
        logger.info(params[0]);
    } else {
        logger.info(params.join(' '));
}
};

const error = (...params) => {
    if (params.length === 1) {
        if (params[0] instanceof Error) {
            logger.error({ err: params[0] }, params[0].message);
        } else if (typeof params[0] === 'string') {
            logger.error(params[0]);
        } else {
            logger.error(params[0]);
        }
    } else {
        logger.error(params.join(' '));
    }
};

// 导出更多日志级别
const debug = (...params) => {
    if (params.length === 1 && typeof params[0] === 'string') {
        logger.debug(params[0]);
    } else {
        logger.debug(params.join(' '));
    }
};

const warn = (...params) => {
    if (params.length === 1 && typeof params[0] === 'string') {
        logger.warn(params[0]);
    } else {
        logger.warn(params.join(' '));
    }
};

// 直接导出 pino logger 实例，用于更高级的用法
const pinoLogger = logger;

module.exports = {
    info,
    error,
    debug,
    warn,
    logger: pinoLogger
};