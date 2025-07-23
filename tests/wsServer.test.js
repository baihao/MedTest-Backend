const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const http = require('http');
const WebSocketServer = require('../websocket/wsServer');
const { User } = require('../models/user');
const config = require('../config/config');

describe('WebSocket Server Tests', () => {
    let server;
    let wsServer;
    let port;
    const jwtSecret = config.SECRET_KEY;

    beforeEach(async () => {
        // 创建HTTP服务器
        server = http.createServer();
        port = 0; // 让系统自动分配端口
        
        // 创建WebSocket服务器
        wsServer = new WebSocketServer(server, {
            port: port
        });
        
        // 启动服务器
        await new Promise((resolve) => {
            server.listen(port, () => {
                port = server.address().port;
                resolve();
            });
        });
    }, 10000); // 增加超时时间

    afterEach(async () => {
        // 关闭WebSocket服务器
        if (wsServer) {
            wsServer.close();
        }
        
        // 关闭HTTP服务器
        if (server) {
            await new Promise((resolve) => {
                server.close(resolve);
            });
        }
    }, 10000); // 增加超时时间

    describe('JWT认证测试', () => {
        test('使用有效JWT token成功建立连接', (done) => {
            // 创建测试用户
            User.create('test_user_123', 'testpassword123').then(testUser => {
                const token = jwt.sign({ userId: testUser.id }, jwtSecret);
                
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                
                ws.on('open', () => {
                    expect(ws.readyState).toBe(WebSocket.OPEN);
                });
                
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    expect(message.type).toBe('auth_success');
                    expect(message.userId).toBe(testUser.id);
                    expect(message.sessionId).toBeDefined();
                    
                    ws.close();
                    
                    // 清理测试用户
                    User.delete(testUser.id).then(() => {
                        done();
                    });
                });
                
                ws.on('error', (error) => {
                    done.fail('连接应该成功建立: ' + error.message);
                });
            }).catch(error => {
                done.fail('创建测试用户失败: ' + error.message);
            });
        }, 10000); // 增加超时时间

        test('缺少JWT token时连接失败', (done) => {
            const ws = new WebSocket(`ws://localhost:${port}/ws`);
            
            ws.on('message', (data) => {
                const message = JSON.parse(data);
                expect(message.type).toBe('auth_failure');
                expect(message.message).toBe('无效的token格式');
                done();
            });
            
            ws.on('error', (error) => {
                // WebSocket连接错误是预期的
                expect(error.message).toContain('Unexpected server response');
            });
        });

        test('无效JWT token时连接失败', (done) => {
            const invalidToken = 'invalid.jwt.token';
            const ws = new WebSocket(`ws://localhost:${port}/ws?token=${invalidToken}`);
            
            ws.on('message', (data) => {
                const message = JSON.parse(data);
                expect(message.type).toBe('auth_failure');
                expect(message.message).toBe('无效token');
                done();
            });
            
            ws.on('error', (error) => {
                // WebSocket连接错误是预期的
                expect(error.message).toContain('Unexpected server response');
            });
        });

        test('JWT token中缺少用户ID时连接失败', (done) => {
            const token = jwt.sign({ otherField: 'value' }, jwtSecret);
            const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
            
            ws.on('message', (data) => {
                const message = JSON.parse(data);
                expect(message.type).toBe('auth_failure');
                expect(message.message).toContain('JWT token中缺少用户ID');
                done();
            });
            
            ws.on('error', (error) => {
                // WebSocket连接错误是预期的
                expect(error.message).toContain('Unexpected server response');
            });
        });

        test('使用过期JWT token时连接失败', (done) => {
            const userId = 123;
            const token = jwt.sign({ userId }, jwtSecret, { expiresIn: '1ms' });
            
            // 等待token过期
            setTimeout(() => {
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    expect(message.type).toBe('auth_failure');
                    expect(message.message).toBe('token已过期');
                    done();
                });
                
                ws.on('error', (error) => {
                    // WebSocket连接错误是预期的
                    expect(error.message).toContain('Unexpected server response');
                });
            }, 10);
        });

        test('使用不存在的用户ID时连接失败', (done) => {
            const nonExistentUserId = 999999;
            const token = jwt.sign({ userId: nonExistentUserId }, jwtSecret);
            
            const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
            
            ws.on('message', (data) => {
                const message = JSON.parse(data);
                expect(message.type).toBe('auth_failure');
                expect(message.message).toBe('用户不存在');
                done();
            });
            
            ws.on('error', (error) => {
                // WebSocket连接错误是预期的
                expect(error.message).toContain('Unexpected server response');
            });
        });

        test('使用有效用户ID时连接成功', (done) => {
            // 创建测试用户
            User.create('test_ws_user', 'testpassword123').then(testUser => {
                const token = jwt.sign({ userId: testUser.id }, jwtSecret);
                
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    expect(message.type).toBe('auth_success');
                    expect(message.userId).toBe(testUser.id);
                    expect(message.sessionId).toBeDefined();
                    
                    ws.close();
                    
                    // 清理测试用户
                    User.delete(testUser.id).then(() => {
                        done();
                    });
                });
                
                ws.on('error', (error) => {
                    done.fail('连接应该成功建立: ' + error.message);
                });
            }).catch(error => {
                done.fail('创建测试用户失败: ' + error.message);
            });
        }, 10000); // 增加超时时间
    });

    describe('会话管理测试', () => {
        test('连接成功后会话信息正确保存', (done) => {
            User.create('test_user_1', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        const status = wsServer.getStatus();
                        
                        expect(status.totalConnections).toBe(1);
                        expect(status.totalUsers).toBe(1);
                        expect(status.activeSessions).toHaveLength(1);
                        expect(status.userSessions[userId]).toHaveLength(1);
                        
                        ws.close();
                        User.delete(userId).then(() => done());
                    }
                });
            });
        });

        test('用户可以有多个连接', (done) => {
            User.create('test_user_2', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                
                let connectionCount = 0;
                const totalConnections = 3;
                const connections = [];
                
                for (let i = 0; i < totalConnections; i++) {
                    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                    connections.push(ws);
                    
                    ws.on('message', (data) => {
                        const message = JSON.parse(data);
                        if (message.type === 'auth_success') {
                            connectionCount++;
                            
                            if (connectionCount === totalConnections) {
                                const status = wsServer.getStatus();
                                expect(status.totalConnections).toBe(totalConnections);
                                expect(status.totalUsers).toBe(1);
                                expect(status.userSessions[userId]).toHaveLength(totalConnections);
                                
                                connections.forEach(conn => conn.close());
                                User.delete(userId).then(() => done());
                            }
                        }
                    });
                }
            });
        }, 10000);

        test('连接断开时会话信息正确清理', (done) => {
            User.create('test_user_3', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        let status = wsServer.getStatus();
                        expect(status.totalConnections).toBe(1);
                        ws.close();
                        setTimeout(() => {
                            status = wsServer.getStatus();
                            expect(status.totalConnections).toBe(0);
                            expect(status.totalUsers).toBe(0);
                            expect(status.activeSessions).toHaveLength(0);
                            User.delete(userId).then(() => done());
                        }, 100);
                    }
                });
            });
        });

        test('获取用户会话信息', (done) => {
            User.create('test_user_8', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        const userSessions = wsServer.getUserSessions(userId);
                        expect(userSessions).toHaveLength(1);
                        expect(userSessions[0].userId).toBe(userId);
                        expect(userSessions[0]).toHaveProperty('sessionId');
                        expect(userSessions[0]).toHaveProperty('connectedAt');
                        expect(userSessions[0]).toHaveProperty('lastActivity');
                        ws.close();
                        User.delete(userId).then(() => done());
                    }
                });
            });
        });

        test('关闭指定用户的所有会话', async () => {
            const testUser = await User.create('test_user_close_sessions', 'testpassword123');
            const userId = testUser.id;
            const token = jwt.sign({ userId }, jwtSecret);
            
            // 创建两个连接
            const ws1 = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
            const ws2 = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
            
            // 等待两个连接都建立
            await Promise.all([
                new Promise(resolve => ws1.on('open', resolve)),
                new Promise(resolve => ws2.on('open', resolve))
            ]);
            
            // 等待认证成功
            await Promise.all([
                new Promise(resolve => {
                    ws1.on('message', (data) => {
                        const message = JSON.parse(data);
                        if (message.type === 'auth_success') resolve();
                    });
                }),
                new Promise(resolve => {
                    ws2.on('message', (data) => {
                        const message = JSON.parse(data);
                        if (message.type === 'auth_success') resolve();
                    });
                })
            ]);
            
            // 验证用户有两个会话
            const userSessions = wsServer.getUserSessions(userId);
            expect(userSessions).toHaveLength(2);
            
            // 关闭用户的所有会话
            const closedCount = wsServer.closeUserSessions(userId, 1000, 'Test closure');
            expect(closedCount).toBe(2);
            
            // 等待连接关闭
            await Promise.all([
                new Promise(resolve => ws1.on('close', resolve)),
                new Promise(resolve => ws2.on('close', resolve))
            ]);
            
            // 验证会话已被清理
            const remainingSessions = wsServer.getUserSessions(userId);
            expect(remainingSessions).toHaveLength(0);
            
            await User.delete(userId);
        });
    });

    describe('消息发送测试', () => {
        test('向用户发送消息成功', (done) => {
            User.create('test_user_5', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                let messageReceived = false;
                
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        const testMessage = {
                            type: 'test_message',
                            content: 'Hello from server',
                            timestamp: new Date().toISOString()
                        };
                        const result = wsServer.sendMsgToUser(userId, testMessage);
                        expect(result).toBe(true);
                    } else if (message.type === 'test_message') {
                        expect(message.content).toBe('Hello from server');
                        messageReceived = true;
                        ws.close();
                        User.delete(userId).then(() => done());
                    }
                });
            });
        });

        test('向不存在的用户发送消息失败', () => {
            const nonExistentUserId = 999999;
            const testMessage = {
                type: 'test_message',
                content: 'This should fail'
            };
            const result = wsServer.sendMsgToUser(nonExistentUserId, testMessage);
            expect(result).toBe(false);
        });

        test('向多个连接的用户发送消息', (done) => {
            User.create('test_user_6', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                const totalConnections = 2;
                let messageCount = 0;
                const connections = [];
                for (let i = 0; i < totalConnections; i++) {
                    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                    connections.push(ws);
                    ws.on('message', (data) => {
                        const message = JSON.parse(data);
                        if (message.type === 'auth_success') {
                            if (connections.length === totalConnections) {
                                const testMessage = {
                                    type: 'broadcast_message',
                                    content: 'Broadcast to all connections'
                                };
                                const result = wsServer.sendMsgToUser(userId, testMessage);
                                expect(result).toBe(true);
                            }
                        } else if (message.type === 'broadcast_message') {
                            messageCount++;
                            expect(message.content).toBe('Broadcast to all connections');
                            if (messageCount === totalConnections) {
                                connections.forEach(conn => conn.close());
                                User.delete(userId).then(() => done());
                            }
                        }
                    });
                }
            });
        });
    });

    describe('消息处理测试', () => {
        test('处理ping消息', (done) => {
            User.create('test_user_7', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    } else if (message.type === 'pong') {
                        expect(message.timestamp).toBeDefined();
                        ws.close();
                        User.delete(userId).then(() => done());
                    }
                });
            });
        });

        test('处理echo消息', (done) => {
            User.create('test_user_8', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        const echoData = { test: 'data', number: 123 };
                        ws.send(JSON.stringify({ type: 'echo', data: echoData }));
                    } else if (message.type === 'echo_response') {
                        expect(message.data).toEqual({ test: 'data', number: 123 });
                        expect(message.timestamp).toBeDefined();
                        ws.close();
                        User.delete(userId).then(() => done());
                    }
                });
            });
        });

        test('处理无效JSON消息', (done) => {
            User.create('test_user_9', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        ws.send('invalid json message');
                    } else if (message.type === 'error') {
                        expect(message.message).toBe('消息格式错误');
                        ws.close();
                        User.delete(userId).then(() => done());
                    }
                });
            });
        });

        test('处理未知消息类型', (done) => {
            User.create('test_user_10', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        ws.send(JSON.stringify({ type: 'unknown_message_type', data: 'test' }));
                        setTimeout(() => {
                            ws.close();
                            User.delete(userId).then(() => done());
                        }, 100);
                    }
                });
            });
        });
    });

    describe('服务器状态测试', () => {
        test('获取服务器状态信息', (done) => {
            User.create('test_user_11', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        const status = wsServer.getStatus();
                        expect(status).toHaveProperty('totalConnections');
                        expect(status).toHaveProperty('totalUsers');
                        expect(status).toHaveProperty('activeSessions');
                        expect(status).toHaveProperty('userSessions');
                        expect(status.totalConnections).toBe(1);
                        expect(status.totalUsers).toBe(1);
                        expect(status.activeSessions).toHaveLength(1);
                        expect(status.userSessions[userId]).toHaveLength(1);
                        ws.close();
                        User.delete(userId).then(() => done());
                    }
                });
            });
        });

        test('服务器关闭时清理所有会话', (done) => {
            User.create('test_user_12', 'testpassword123').then(testUser => {
                const userId = testUser.id;
                const token = jwt.sign({ userId }, jwtSecret);
                const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        let status = wsServer.getStatus();
                        expect(status.totalConnections).toBe(1);
                        wsServer.close();
                        status = wsServer.getStatus();
                        expect(status.totalConnections).toBe(0);
                        expect(status.totalUsers).toBe(0);
                        ws.close();
                        User.delete(userId).then(() => done());
                    }
                });
            });
        });
    });

    describe('心跳机制测试', () => {
        test('服务端心跳超时会自动断开连接', async () => {
            wsServer.heartbeatInterval = 500;
            wsServer.startHeartbeat();
            const testUser = await User.create('test_user_heartbeat1', 'testpassword123');
            const userId = testUser.id;
            const token = jwt.sign({ userId }, jwtSecret);
            const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);

            // 等待连接建立
            await new Promise(resolve => ws.on('open', resolve));

            // 移除 ws 的底层 socket 的 'data' 事件监听器，阻止自动 pong
            if (ws._socket) {
                ws._socket.removeAllListeners('data');
            }

            const closeEvent = await new Promise((resolve, reject) => {
                ws.on('close', (code, reason) => resolve({ code, reason }));
                setTimeout(() => reject(new Error('未检测到心跳超时断开')), 2500);
            });

            expect([4000, 1005, 1006]).toContain(closeEvent.code);
            await User.delete(userId);
        }, 6000);

        test('客户端自定义ping服务端能正确回复pong', async () => {
            const testUser = await User.create('test_user_heartbeat2', 'testpassword123');
            const userId = testUser.id;
            const token = jwt.sign({ userId }, jwtSecret);
            const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);

            await new Promise((resolve, reject) => {
                let pongReceived = false;
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message.type === 'auth_success') {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    } else if (message.type === 'pong') {
                        pongReceived = true;
                        ws.close();
                        resolve();
                    }
                });
                setTimeout(() => {
                    if (!pongReceived) {
                        ws.close();
                        reject(new Error('未收到pong响应'));
                    }
                }, 2000);
            });
            await User.delete(userId);
        });
    });
}); 