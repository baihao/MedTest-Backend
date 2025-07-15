const request = require('supertest');
const { app } = require('../index');
const { User } = require('../models/user');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { generateUniqueUsername, generateUniqueWorkspaceName } = require('./utils');

describe('JWT Authentication Middleware', () => {
    let testUser;
    let validToken;
    let expiredToken;
    let server;

    beforeAll(async () => {
        // 启动测试服务器
        const PORT = 3002; // 使用不同的端口避免冲突
        server = app.listen(PORT);
    });

    afterAll(async () => {
        // 关闭测试服务器
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    beforeEach(async () => {
        // 重新创建用户并生成token，确保userId和token一致
        testUser = await User.create(generateUniqueUsername('testuser'), 'password');
        validToken = jwt.sign(
            { id: Number(testUser.id), username: testUser.username },
            config.SECRET_KEY,
            { expiresIn: '1h' }
        );
        expiredToken = jwt.sign(
            { id: Number(testUser.id), username: testUser.username },
            config.SECRET_KEY,
            { expiresIn: '-1s' }
        );
    });

    describe('Bearer Token Format Support', () => {
        it('应该接受Bearer token格式', async () => {
            const workspaceName = generateUniqueWorkspaceName('测试工作空间');
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ name: workspaceName });
            
            // 临时添加错误信息输出
            if (response.statusCode === 500) {
                console.error('500错误详情:', response.body);
            }
            
            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body.name).toBe(workspaceName);
        });

        it('应该向后兼容没有Bearer前缀的token', async () => {
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', validToken)
                .send({ name: generateUniqueWorkspaceName('测试工作空间2') });
            
            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('id');
        });

        it('应该拒绝空的Bearer token', async () => {
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', 'Bearer ')
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            
            expect(response.statusCode).toBe(401);
            expect(response.body.error).toBe('无效的token格式');
        });
    });

    describe('Token Validation', () => {
        it('应该拒绝没有Authorization header的请求', async () => {
            const response = await request(server)
                .post('/workspace/create')
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            
            expect(response.statusCode).toBe(401);
            expect(response.body.error).toBe('未提供认证token');
        });

        it('应该拒绝无效的token', async () => {
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', 'Bearer invalid.token.here')
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            
            expect(response.statusCode).toBe(403);
            expect(response.body.error).toBe('无效token');
        });

        it('应该拒绝过期的token', async () => {
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', `Bearer ${expiredToken}`)
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            
            expect(response.statusCode).toBe(401);
            expect(response.body.error).toBe('token已过期');
        });

        it('应该拒绝使用错误密钥签名的token', async () => {
            const wrongKeyToken = jwt.sign(
                { id: testUser.id, username: testUser.username }, 
                'wrong-secret-key', 
                { expiresIn: '1h' }
            );
            
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', `Bearer ${wrongKeyToken}`)
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            
            expect(response.statusCode).toBe(403);
            expect(response.body.error).toBe('无效token');
        });
    });

    describe('Protected Routes Access', () => {
        it('应该允许访问受保护的工作空间创建路由', async () => {
            const workspaceName = generateUniqueWorkspaceName('受保护的工作空间');
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ name: workspaceName });
            
            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('name');
            expect(response.body.name).toBe(workspaceName);
        });

        it('应该允许访问受保护的工作空间列表路由', async () => {
            // 先创建一个工作空间
            const workspaceName = generateUniqueWorkspaceName('列表测试工作空间');
            await request(server)
                .post('/workspace/create')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ name: workspaceName });
            
            const response = await request(server)
                .get('/workspace')
                .set('Authorization', `Bearer ${validToken}`);
            
            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0].userId).toBe(testUser.id);
            expect(response.body[0].name).toBe(workspaceName);
        });

        it('应该拒绝访问受保护的路由（无token）', async () => {
            const response = await request(server)
                .get('/workspace');
            
            expect(response.statusCode).toBe(401);
            expect(response.body.error).toBe('未提供认证token');
        });
    });

    describe('User Context in Protected Routes', () => {
        it('应该正确传递用户信息到路由处理器', async () => {
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ name: generateUniqueWorkspaceName('用户上下文测试') });
            
            expect(response.statusCode).toBe(201);
            
            // 验证工作空间属于正确的用户
            const workspaceResponse = await request(server)
                .get(`/workspace/${response.body.id}`)
                .set('Authorization', `Bearer ${validToken}`);
            
            expect(workspaceResponse.statusCode).toBe(200);
            expect(workspaceResponse.body.userId).toBe(testUser.id);
        });
    });

    describe('Token Format Edge Cases', () => {
        it('应该处理只有Bearer前缀的情况', async () => {
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', 'Bearer')
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            
            expect(response.statusCode).toBe(401);
            expect(response.body.error).toBe('无效的token格式');
        });

        it('应该处理Bearer前缀后只有空格的情况', async () => {
            const response = await request(server)
                .post('/workspace/create')
                .set('Authorization', 'Bearer   ')
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            
            expect(response.statusCode).toBe(401);
            expect(response.body.error).toBe('无效的token格式');
        });
    });
}); 