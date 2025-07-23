require('dotenv').config();
const express = require('express');
const { ModelManager } = require('./models/modelmgr');
const loginRoutes = require('./routes/login');
const workspaceRoutes = require('./routes/workspace');
const labreportRoutes = require('./routes/labreport');
const labreportitemRoutes = require('./routes/labreportitem');
const ocrdataRoutes = require('./routes/ocrdata');
const { errorHandler } = require('./config/midware');
const { logger } = require('./config/logger');
const WebSocketServer = require('./websocket/wsServer');
const config = require('./config/config');

const app = express();
let server = null;
let wsServer = null;

app.use(express.json());
app.use('/login', loginRoutes);
app.use('/workspace', workspaceRoutes);
app.use('/labreport', labreportRoutes);
app.use('/labreportitem', labreportitemRoutes);
app.use('/ocrdata', ocrdataRoutes);
app.use(errorHandler);

// 初始化数据库和模型
async function startServer() {
    try {
        logger.info('正在启动服务器...');
        
        // 初始化所有模型
        await ModelManager.init();
        
        const PORT = config.SERVER_PORT;
        server = app.listen(PORT, () => {
            logger.info(`HTTP服务器运行在端口 ${PORT}`);
        });
        // 启动WebSocket服务器，复用同一个端口
        wsServer = new WebSocketServer(server);
        logger.info(`WebSocket服务器复用HTTP端口 ${PORT}`);
        
        // 优雅关闭
        process.on('SIGTERM', async () => {
            logger.info('收到SIGTERM信号，正在关闭服务器...');
            if (wsServer) {
                wsServer.close();
            }
            if (server) {
                server.close(async () => {
                    await ModelManager.close();
                    process.exit(0);
                });
            }
        });
        
        process.on('SIGINT', async () => {
            logger.info('收到SIGINT信号，正在关闭服务器...');
            if (wsServer) {
                wsServer.close();
            }
            if (server) {
                server.close(async () => {
                    await ModelManager.close();
                    process.exit(0);
                });
            }
        });
        
    } catch (error) {
        logger.error('服务器启动失败:', error);
        process.exit(1);
    }
}

// 只在非测试环境中启动服务器
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

module.exports = { app, server, wsServer };