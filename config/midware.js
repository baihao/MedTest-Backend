const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('./config');
const { Workspace } = require('../models/workspace');
const { logger } = require('./logger');

// 脱敏body中的password
function maskPassword(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clone = { ...obj };
    if ('password' in clone) clone.password = '***';
    return clone;
}

// JWT认证中间件
function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(401).json({ error: '未提供认证token' });
    }

    // 只支持严格的'Bearer '前缀，且大小写敏感
    let token;
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else {
        // 向后兼容：如果没有Bearer前缀，直接使用整个值
        token = authHeader.trim();
    }

    // token为空或全是空格，直接返回401
    if (!token) {
        return res.status(401).json({ error: '无效的token格式' });
    }
    // token不是有效的JWT格式（例如只有Bearer或Bearer+空格），直接返回401
    if (!/^([A-Za-z0-9-_]+\.){2}[A-Za-z0-9-_]+$/.test(token)) {
        return res.status(401).json({ error: '无效的token格式' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'token已过期' });
            } else if (err.name === 'JsonWebTokenError') {
                return res.status(403).json({ error: '无效token' });
            } else {
                return res.status(403).json({ error: 'token验证失败' });
            }
        }
        req.user = user;
        next();
    });
}

// Workspace权限检查中间件
async function checkWorkspaceOwnership(req, res, next) {
    try {
        const workspace = await Workspace.findById(req.params.id);
        if (!workspace) {
            return res.status(404).json({ error: '未找到对应workspace' });
        }
        if (workspace.userId !== req.user.id) {
            return res.status(403).json({ error: '无权访问此workspace' });
        }
        req.workspace = workspace;
        next();
    } catch (error) {
        next(error);
    }
}

// 简单的详细日志中间件
function detailedLogger(req, res, next) {
    const start = Date.now();
    
    // 记录请求
    const requestInfo = {
        method: req.method,
        url: req.originalUrl,
        body: maskPassword(req.body),
        params: req.params,
        query: req.query,
        user: req.user || null
    };
    
    logger.info(`[REQUEST] ${JSON.stringify(requestInfo, null, 2)}`);
    
    // 监听响应完成事件
    res.on('finish', () => {
        const duration = Date.now() - start;
        const responseInfo = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            user: req.user || null
        };
        
        logger.info(`[RESPONSE] ${JSON.stringify(responseInfo, null, 2)}`);
    });
    
    next();
}

// 错误处理中间件
function errorHandler(err, req, res, next) {
    // 记录错误日志
    const errorInfo = {
        method: req.method,
        url: req.originalUrl,
        body: maskPassword(req.body),
        error: err.message,
        stack: err.stack,
        user: req.user || null
    };
    
    logger.error(`[ERROR] ${JSON.stringify(errorInfo, null, 2)}`);
    
    // 根据错误类型返回相应的状态码
    let statusCode = 500;
    let message = '服务器内部错误';
    
    // 检查自定义错误类型（使用模式匹配）
    if (err.name && err.name.endsWith('Error')) {
        // 处理所有以 'Error' 结尾的自定义错误类
        switch (err.name) {
            case 'ValidationError':
                statusCode = 400;
                break;
            case 'UnauthorizedError':
                statusCode = 401;
                break;
            case 'NotFoundError':
                statusCode = 404;
                break;
            case 'ConflictError':
                statusCode = 409;
                break;
            case 'UserError':
            case 'WorkspaceError':
            case 'LabReportError':
            case 'LabReportItemError':
                // 这些错误类都有 statusCode 属性
                statusCode = err.statusCode || 400;
                break;
            default:
                // 其他自定义错误，尝试使用 statusCode
                if (err.statusCode) {
                    statusCode = err.statusCode;
                }
        }
        message = err.message;
    } else if (err.statusCode) {
        // 直接检查 statusCode
        statusCode = err.statusCode;
        message = err.message;
    } else {
        statusCode = 500;
        message = err.message || '服务器内部错误';
    }
    
    res.status(statusCode).json({
        error: {
            message: message,
            statusCode: statusCode,
            timestamp: new Date().toISOString()
        }
    });
}

// 简单的请求日志中间件（保持向后兼容）
function requestLogger(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    
    next();
}

module.exports = {
    authenticateJWT,
    checkWorkspaceOwnership,
    errorHandler,
    requestLogger,
    detailedLogger,
    maskPassword
};