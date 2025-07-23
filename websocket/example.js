const http = require('http');
const jwt = require('jsonwebtoken');
const WebSocketServer = require('./wsServer');

// 创建HTTP服务器
const server = http.createServer();

// 创建WebSocket服务器
const wsServer = new WebSocketServer(server, {
    jwtSecret: 'your-jwt-secret-key',
    port: 8080
});

// 启动服务器
server.listen(8080, () => {
    console.log('WebSocket服务器运行在端口 8080');
    console.log('WebSocket连接地址: ws://localhost:8080/ws?token=YOUR_JWT_TOKEN');
});

// 示例：生成JWT token
function generateToken(userId) {
    return jwt.sign({ userId }, 'your-jwt-secret-key', { expiresIn: '24h' });
}

// 示例：向用户发送消息
function sendMessageToUser(userId, message) {
    const result = wsServer.sendMsgToUser(userId, message);
    if (result) {
        console.log(`消息已发送给用户 ${userId}`);
    } else {
        console.log(`用户 ${userId} 没有活跃连接`);
    }
}

// 示例：获取服务器状态
function getServerStatus() {
    const status = wsServer.getStatus();
    console.log('服务器状态:', status);
    return status;
}

// 示例：获取用户会话信息
function getUserSessions(userId) {
    const sessions = wsServer.getUserSessions(userId);
    console.log(`用户 ${userId} 的会话信息:`, sessions);
    return sessions;
}

// 示例用法
setInterval(() => {
    const status = getServerStatus();
    if (status.totalUsers > 0) {
        // 向所有在线用户发送心跳消息
        Object.keys(status.userSessions).forEach(userId => {
            sendMessageToUser(userId, {
                type: 'heartbeat',
                message: '服务器心跳',
                timestamp: new Date().toISOString()
            });
        });
    }
}, 30000); // 每30秒发送一次心跳

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在关闭WebSocket服务器...');
    wsServer.close();
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

// 示例：关闭指定用户的所有会话
console.log('\n=== 关闭用户会话示例 ===');

// 假设用户ID为123的用户有多个连接
const userId = 123;

// 关闭用户的所有会话（正常关闭）
const closedCount = wsServer.closeUserSessions(userId, 1000, 'User logout');
console.log(`已关闭用户 ${userId} 的 ${closedCount} 个会话`);

// 强制关闭用户的所有会话（管理员操作）
const forceClosedCount = wsServer.closeUserSessions(userId, 1008, 'Administrative action');
console.log(`已强制关闭用户 ${userId} 的 ${forceClosedCount} 个会话`);

// 检查用户是否还有活跃会话
const remainingSessions = wsServer.getUserSessions(userId);
console.log(`用户 ${userId} 剩余会话数: ${remainingSessions.length}`);

// 实际应用示例：OCR处理完成后通知用户
console.log('\n=== OCR处理完成通知示例 ===');

const { getUserIdFromLabReport } = require('../config/utils');

async function notifyUserAfterOcrProcessing(labReportId) {
    try {
        // 1. 根据LabReport ID获取用户ID
        const userId = await getUserIdFromLabReport(labReportId);
        
        if (!userId) {
            console.log(`无法找到LabReport ${labReportId} 对应的用户`);
            return false;
        }
        
        // 2. 通过WebSocket向用户发送通知
        const notification = {
            type: 'ocr_completed',
            labReportId: labReportId,
            message: '您的检验报告OCR处理已完成',
            timestamp: new Date().toISOString(),
            status: 'success'
        };
        
        const success = wsServer.sendMsgToUser(userId, notification);
        
        if (success) {
            console.log(`已向用户 ${userId} 发送OCR完成通知`);
            return true;
        } else {
            console.log(`用户 ${userId} 当前没有活跃连接`);
            return false;
        }
    } catch (error) {
        console.error('发送OCR完成通知失败:', error);
        return false;
    }
}

// 模拟OCR处理完成后的通知
// notifyUserAfterOcrProcessing(123);

module.exports = {
    wsServer,
    generateToken,
    sendMessageToUser,
    getServerStatus,
    getUserSessions
}; 