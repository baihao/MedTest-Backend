const WebSocket = require('ws');

// WebSocket服务器
function createWebSocketServer() {
    const wss = new WebSocket.Server({ port: 8080 });
    
    console.log('WebSocket服务器启动在端口 8080');
    
    // 存储所有连接的客户端
    const clients = new Set();
    
    wss.on('connection', (ws) => {
        console.log('新客户端连接');
        clients.add(ws);
        
        // 发送欢迎消息
        ws.send(JSON.stringify({
            type: 'system',
            message: '欢迎连接到WebSocket服务器!'
        }));
        
        // 处理客户端消息
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('收到客户端消息:', data);
                
                // 广播消息给所有客户端
                broadcast({
                    type: 'broadcast',
                    from: 'server',
                    message: data.message,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('消息解析错误:', error);
            }
        });
        
        // 处理连接关闭
        ws.on('close', () => {
            console.log('客户端断开连接');
            clients.delete(ws);
            
            // 通知其他客户端
            broadcast({
                type: 'system',
                message: '有客户端断开连接',
                timestamp: new Date().toISOString()
            });
        });
        
        // 处理错误
        ws.on('error', (error) => {
            console.error('WebSocket错误:', error);
            clients.delete(ws);
        });
    });
    
    // 广播消息给所有客户端
    function broadcast(message) {
        const messageStr = JSON.stringify(message);
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }
    
    // 定期发送系统消息
    setInterval(() => {
        broadcast({
            type: 'system',
            message: `服务器时间: ${new Date().toISOString()}`,
            timestamp: new Date().toISOString()
        });
    }, 10000); // 每10秒发送一次
    
    return wss;
}

// WebSocket客户端
function createWebSocketClient(clientName) {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.on('open', () => {
        console.log(`${clientName} 已连接到服务器`);
        
        // 发送消息
        setTimeout(() => {
            ws.send(JSON.stringify({
                type: 'message',
                message: `Hello from ${clientName}!`
            }));
        }, 1000);
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data);
        console.log(`${clientName} 收到消息:`, message);
    });
    
    ws.on('close', () => {
        console.log(`${clientName} 连接已关闭`);
    });
    
    ws.on('error', (error) => {
        console.error(`${clientName} 错误:`, error);
    });
    
    return ws;
}

// 主函数
function main() {
    console.log('启动WebSocket发布-订阅示例...');
    
    // 启动服务器
    const server = createWebSocketServer();
    
    // 等待服务器启动
    setTimeout(() => {
        // 启动客户端
        const client1 = createWebSocketClient('客户端1');
        const client2 = createWebSocketClient('客户端2');
        
        // 5秒后关闭客户端
        setTimeout(() => {
            client1.close();
            client2.close();
            
            // 关闭服务器
            setTimeout(() => {
                server.close();
                console.log('示例结束');
            }, 1000);
        }, 5000);
    }, 1000);
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
    main();
}

module.exports = { createWebSocketServer, createWebSocketClient }; 