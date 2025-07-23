const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const logger = require('../config/logger');
const config = require('../config/config');
const { User } = require('../models/user');
const { verifyJWT } = require('../config/utils');

/**
 * WebSocket服务器类
 * 提供JWT认证、会话管理和用户消息发送功能
 */
class WebSocketServer {
    constructor(server, options = {}) {
        this.server = server;
        this.jwtSecret = config.SECRET_KEY || 'default-secret-key';
        this.port = options.port || 8080;
        this.heartbeatInterval = config.WS_SERVER_HEARTBEAT_INTERVAL || 60000;
        // 会话管理
        this.sessions = new Map(); // sessionId -> { ws, userId, connectedAt, lastActivity }
        this.userSessions = new Map(); // userId -> Set of sessionIds
        this.wss = null;
        this.heartbeatTimer = null;
        this.init();
    }

    /**
     * 初始化WebSocket服务器
     */
    init() {
        this.wss = new WebSocket.Server({ 
            server: this.server,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        // 启动心跳定时器
        this.startHeartbeat();
        logger.info('WebSocket服务器已启动');
    }

    /**
     * 服务端心跳定时器
     */
    startHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();
            for (const [sessionId, session] of this.sessions.entries()) {
                const ws = session.ws;
                // 超时未活跃则关闭
                if (now - session.lastActivity > 2 * this.heartbeatInterval) {
                    logger.info(`会话超时，关闭连接: ${sessionId}`);
                    // 使用terminate() 而不是 close() 来确保连接立即关闭
                    ws.terminate();
                    this.handleDisconnection(sessionId, 1000, 'heartbeat timeout');
                } else {
                    // 发送ping帧
                    if (ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.ping();
                        } catch (e) {
                            logger.warn('发送ping失败:', e);
                        }
                    }
                }
            }
        }, this.heartbeatInterval);
    }

    /**
     * 处理新连接
     * @param {WebSocket} ws - WebSocket连接
     * @param {Object} req - HTTP请求对象
     */
    async handleConnection(ws, req) {
        try {
            // 解析URL参数获取JWT token
            const parsedUrl = url.parse(req.url, true);
            const token = parsedUrl.query.token;

            // 统一使用工具函数验证
            const result = verifyJWT(token, this.jwtSecret);
            if (!result.valid) {
                this.sendAuthFailure(ws, result.error);
                return;
            }
            const decoded = result.payload;
            const userId = decoded.userId || decoded.id;

            if (!userId) {
                this.sendAuthFailure(ws, 'JWT token中缺少用户ID');
                return;
            }

            // 验证用户是否在数据库中存在
            try {
                const numericUserId = Number(userId);
                if (isNaN(numericUserId)) {
                    this.sendAuthFailure(ws, '用户ID格式无效');
                    return;
                }
                
                const user = await User.findById(numericUserId);
                if (!user) {
                    this.sendAuthFailure(ws, '用户不存在');
                    return;
                }
            } catch (error) {
                logger.error('验证用户存在性时出错:', error);
                this.sendAuthFailure(ws, '用户验证失败');
                return;
            }

            // 认证成功，建立连接
            this.establishConnection(ws, userId, req);

        } catch (error) {
            logger.error('WebSocket连接认证失败:', error.message);
            this.sendAuthFailure(ws, 'JWT token验证失败: ' + error.message);
        }
    }

    /**
     * 发送认证失败消息并关闭连接
     * @param {WebSocket} ws - WebSocket连接
     * @param {string} message - 错误消息
     */
    sendAuthFailure(ws, message) {
        const errorMessage = {
            type: 'auth_failure',
            message: message,
            timestamp: new Date().toISOString()
        };

        ws.send(JSON.stringify(errorMessage));
        ws.close(1008, 'Authentication failed'); // 1008: Policy violation
    }

    /**
     * 建立认证成功的连接
     * @param {WebSocket} ws - WebSocket连接
     * @param {string} userId - 用户ID
     * @param {Object} req - HTTP请求对象
     */
    establishConnection(ws, userId, req) {
        // 生成会话ID
        const sessionId = this.generateSessionId();
        const connectionInfo = {
            sessionId,
            ws,
            userId,
            connectedAt: new Date(),
            lastActivity: Date.now(),
            ipAddress: req.socket.remoteAddress,
            userAgent: req.headers['user-agent']
        };

        // 保存会话信息
        this.sessions.set(sessionId, connectionInfo);

        // 添加到用户会话映射
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, new Set());
        }
        this.userSessions.get(userId).add(sessionId);

        // 绑定用户信息到WebSocket对象
        ws.sessionId = sessionId;
        ws.userId = userId;

        // 发送认证成功消息
        const successMessage = {
            type: 'auth_success',
            sessionId: sessionId,
            userId: userId,
            timestamp: new Date().toISOString()
        };
        ws.send(JSON.stringify(successMessage));

        // 设置消息处理器
        ws.on('message', (data) => {
            this.handleMessage(ws, data);
        });

        // 设置连接关闭处理器
        ws.on('close', (code, reason) => {
            this.handleDisconnection(sessionId, code, reason);
        });

        // 设置错误处理器
        ws.on('error', (error) => {
            logger.error(`WebSocket连接错误 [${sessionId}]:`, error);
            this.handleDisconnection(sessionId, 1011, 'Internal error');
        });

        // 绑定心跳事件
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
            if (ws.sessionId && this.sessions.has(ws.sessionId)) {
                this.sessions.get(ws.sessionId).lastActivity = Date.now();
                logger.info(`update lastActivity in pong [${ws.sessionId}]:`, this.sessions.get(ws.sessionId).lastActivity);
            }
        });

        logger.info(`用户 ${userId} 连接成功，会话ID: ${sessionId}`);
    }

    /**
     * 处理接收到的消息
     * @param {WebSocket} ws - WebSocket连接
     * @param {Buffer|string} data - 消息数据
     */
    handleMessage(ws, data) {
        try {
            // 兼容客户端自定义ping
            const msgStr = data.toString();
            let message;
            try {
                message = JSON.parse(msgStr);
            } catch {
                message = null;
            }

            // 收到业务消息时刷新 lastActivity.
            if (ws.sessionId && this.sessions.has(ws.sessionId)) {
                this.sessions.get(ws.sessionId).lastActivity = Date.now();
                logger.info(`update lastActivity in handleMessage [${ws.sessionId}]:`, this.sessions.get(ws.sessionId).lastActivity);
            }

            const sessionId = ws.sessionId;
            const userId = ws.userId;

            logger.info(`收到消息 [${sessionId}]:`, message);

            if (!message) {
                logger.warn(`收到空消息 [${sessionId}]:`, message);
                this.sendMessage(ws, {
                    type: 'error',
                    message: '消息格式错误',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            switch (message.type) {
                case 'echo':
                    this.sendMessage(ws, { 
                        type: 'echo_response', 
                        data: message.data,
                        timestamp: new Date().toISOString()
                    });
                    break;
                case 'ping':
                    this.sendMessage(ws, { type: 'pong', timestamp: new Date().toISOString() });
                    break;
                default:
                    logger.warn(`未知消息类型 [${sessionId}]:`, message.type);
            }

        } catch (error) {
            logger.error('消息处理错误:', error);
            this.sendMessage(ws, {
                type: 'error',
                message: '消息格式错误',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 处理连接断开
     * @param {string} sessionId - 会话ID
     * @param {number} code - 关闭代码
     * @param {string} reason - 关闭原因
     */
    handleDisconnection(sessionId, code, reason) {
        const session = this.sessions.get(sessionId);
        if (session) {
            const userId = session.userId;
            
            // 从会话映射中移除
            this.sessions.delete(sessionId);
            
            // 从用户会话映射中移除
            if (this.userSessions.has(userId)) {
                this.userSessions.get(userId).delete(sessionId);
                if (this.userSessions.get(userId).size === 0) {
                    this.userSessions.delete(userId);
                }
            }

            logger.info(`用户 ${userId} 断开连接，会话ID: ${sessionId}, 代码: ${code}, 原因: ${reason}`);
        }
    }

    /**
     * 向指定用户发送消息
     * @param {string} userId - 用户ID
     * @param {Object} message - 消息对象
     * @returns {boolean} 是否发送成功
     */
    sendMsgToUser(userId, message) {
        const userSessions = this.userSessions.get(userId);
        if (!userSessions || userSessions.size === 0) {
            logger.warn(`用户 ${userId} 没有活跃连接`);
            return false;
        }

        let successCount = 0;
        const messageStr = JSON.stringify(message);

        for (const sessionId of userSessions) {
            const session = this.sessions.get(sessionId);
            if (session && session.ws.readyState === WebSocket.OPEN) {
                try {
                    session.ws.send(messageStr);
                    session.lastActivity = new Date();
                    logger.info(`update lastActivity in sendMsgToUser [${sessionId}]:`, session.lastActivity);
                    successCount++;
                } catch (error) {
                    logger.error(`向用户 ${userId} 发送消息失败 [${sessionId}]:`, error);
                    // 标记连接为无效，下次清理
                    this.handleDisconnection(sessionId, 1011, 'Send error');
                }
            } else {
                // 连接已关闭，清理会话
                this.handleDisconnection(sessionId, 1000, 'Connection closed');
            }
        }

        logger.info(`向用户 ${userId} 发送消息，成功: ${successCount}/${userSessions.size}`);
        return successCount > 0;
    }

    /**
     * 关闭指定用户的所有会话
     * @param {string} userId - 用户ID
     * @param {number} code - 关闭代码，默认1000 (Normal closure)
     * @param {string} reason - 关闭原因，默认'User session closed'
     * @returns {number} 关闭的会话数量
     */
    closeUserSessions(userId, code = 1000, reason = 'User session closed') {
        const userSessions = this.userSessions.get(userId);
        if (!userSessions || userSessions.size === 0) {
            logger.warn(`用户 ${userId} 没有活跃连接需要关闭`);
            return 0;
        }

        let closedCount = 0;
        const sessionIds = Array.from(userSessions); // 创建副本，避免在迭代时修改

        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (session && session.ws.readyState === WebSocket.OPEN) {
                try {
                    // 发送关闭消息给客户端
                    const closeMessage = {
                        type: 'session_closed',
                        reason: reason,
                        timestamp: new Date().toISOString()
                    };
                    session.ws.send(JSON.stringify(closeMessage));
                    
                    // 关闭WebSocket连接
                    session.ws.close(code, reason);
                    closedCount++;
                    
                    logger.info(`已关闭用户 ${userId} 的会话 [${sessionId}]`);
                } catch (error) {
                    logger.error(`关闭用户 ${userId} 会话失败 [${sessionId}]:`, error);
                    // 强制断开连接
                    session.ws.terminate();
                    closedCount++;
                }
            } else {
                // 连接已经关闭，直接清理会话信息
                this.handleDisconnection(sessionId, code, reason);
                closedCount++;
            }
        }

        logger.info(`用户 ${userId} 的所有会话已关闭，共关闭 ${closedCount} 个会话`);
        return closedCount;
    }

    /**
     * 向指定WebSocket连接发送消息
     * @param {WebSocket} ws - WebSocket连接
     * @param {Object} message - 消息对象
     */
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                logger.error('发送消息失败:', error);
            }
        }
    }

    /**
     * 生成会话ID
     * @returns {string} 会话ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 获取服务器状态信息
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            totalConnections: this.sessions.size,
            totalUsers: this.userSessions.size,
            activeSessions: Array.from(this.sessions.keys()),
            userSessions: Object.fromEntries(
                Array.from(this.userSessions.entries()).map(([userId, sessions]) => [
                    userId, 
                    Array.from(sessions)
                ])
            )
        };
    }

    /**
     * 获取用户连接信息
     * @param {string} userId - 用户ID
     * @returns {Array} 用户的所有会话信息
     */
    getUserSessions(userId) {
        const sessionIds = this.userSessions.get(userId);
        if (!sessionIds) {
            return [];
        }

        return Array.from(sessionIds).map(sessionId => {
            const session = this.sessions.get(sessionId);
            return {
                sessionId: session.sessionId,
                userId: session.userId,
                connectedAt: session.connectedAt,
                lastActivity: session.lastActivity,
                ipAddress: session.ipAddress,
                userAgent: session.userAgent
            };
        });
    }

    /**
     * 关闭服务器
     */
    close() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.wss) {
            this.wss.close();
            this.sessions.clear();
            this.userSessions.clear();
            logger.info('WebSocket服务器已关闭');
        }
    }
}

module.exports = WebSocketServer; 