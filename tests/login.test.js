const request = require('supertest');
const { app } = require('../index');
const { User } = require('../models/user');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { generateUniqueUsername } = require('./utils');

describe('Login API', () => {
    let server;

    beforeAll(async () => {
        // 启动测试服务器
        const PORT = 3001; // 使用不同的端口避免冲突
        server = app.listen(PORT);
    });

    afterAll(async () => {
        // 关闭测试服务器
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    test('1. 新用户注册', async () => {
        const username = generateUniqueUsername('newuser');
        const response = await request(server)
            .post('/login')
            .send({ username: username, password: 'password123' });
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('username');
        expect(response.body.username).toBe(username);
        
        // 验证JWT
        const decoded = jwt.verify(response.body.token, config.SECRET_KEY);
        expect(decoded.username).toBe(username);
    });

    test('2. 已有用户登录成功', async () => {
        // 先创建测试用户
        const username = generateUniqueUsername('existing');
        await User.create(username, 'correctpass');
        
        const response = await request(server)
            .post('/login')
            .send({ username: username, password: 'correctpass' });
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body.username).toBe(username);
    });

    test('3. 密码错误', async () => {
        const username = generateUniqueUsername('wrongpass');
        await User.create(username, 'realpass');
        
        const response = await request(server)
            .post('/login')
            .send({ username: username, password: 'wrongpass' });
        
        expect(response.statusCode).toBe(401);
        expect(response.body.error).toBe('Invalid credentials');
    });

    test('4. 缺少用户名', async () => {
        const response = await request(server)
            .post('/login')
            .send({ password: 'somepass' });
        
        expect(response.statusCode).toBe(400);
        expect(response.body.error).toBe('Username and password are required');
    });

    test('5. 缺少密码', async () => {
        const response = await request(server)
            .post('/login')
            .send({ username: 'nopass' });
        
        expect(response.statusCode).toBe(400);
        expect(response.body.error).toBe('Username and password are required');
    });

    test('6. 用户名长度超过100个字符', async () => {
        const username = 'a'.repeat(101);
        const response = await request(server)
            .post('/login')
            .send({ username: username, password: 'password123' });
        
        expect(response.statusCode).toBe(400);
        expect(response.body.error.message).toBe('用户名长度必须在3-50字符之间');
        expect(response.body.error.statusCode).toBe(400);
        expect(response.body.error).toHaveProperty('timestamp');
    });
});