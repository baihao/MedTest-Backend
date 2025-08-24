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

    describe('checkToken API', () => {
        test('1. 有效token验证成功', async () => {
            // 创建一个测试用户并获取有效token
            const validUsername = generateUniqueUsername('checktoken');
            const response = await request(server)
                .post('/login')
                .send({ username: validUsername, password: 'password123' });
            
            const validToken = response.body.token;
            
            // 立即验证token
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ username: validUsername, token: validToken });
            
            expect(checkResponse.statusCode).toBe(200);
            expect(checkResponse.body.valid).toBe(true);
            expect(checkResponse.body.username).toBe(validUsername);
            expect(checkResponse.body).toHaveProperty('expiresAt');
        });

        test('2. 缺少username参数', async () => {
            // 创建一个测试用户并获取有效token
            const validUsername = generateUniqueUsername('checktoken2');
            const response = await request(server)
                .post('/login')
                .send({ username: validUsername, password: 'password123' });
            
            const validToken = response.body.token;
            
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ token: validToken });
            
            expect(checkResponse.statusCode).toBe(400);
            expect(checkResponse.body.error).toBe('Username and token are required');
        });

        test('3. 缺少token参数', async () => {
            // 创建一个测试用户并获取有效token
            const validUsername = generateUniqueUsername('checktoken3');
            const response = await request(server)
                .post('/login')
                .send({ username: validUsername, password: 'password123' });
            
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ username: validUsername });
            
            expect(checkResponse.statusCode).toBe(400);
            expect(checkResponse.body.error).toBe('Username and token are required');
        });

        test('4. 无效的token格式', async () => {
            // 创建一个测试用户
            const validUsername = generateUniqueUsername('checktoken4');
            await request(server)
                .post('/login')
                .send({ username: validUsername, password: 'password123' });
            
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ username: validUsername, token: 'invalid-token-format' });
            
            expect(checkResponse.statusCode).toBe(401);
            expect(checkResponse.body.error).toBe('Invalid token');
            expect(checkResponse.body.valid).toBe(false);
        });

        test('5. token中的username不匹配', async () => {
            // 创建两个测试用户
            const username1 = generateUniqueUsername('user1');
            const username2 = generateUniqueUsername('user2');
            
            const response1 = await request(server)
                .post('/login')
                .send({ username: username1, password: 'password123' });
            
            const response2 = await request(server)
                .post('/login')
                .send({ username: username2, password: 'password123' });
            
            const token1 = response1.body.token;
            
            // 用用户1的token验证用户2
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ username: username2, token: token1 });
            
            expect(checkResponse.statusCode).toBe(401);
            expect(checkResponse.body.error).toBe('Token username mismatch');
            expect(checkResponse.body.valid).toBe(false);
        });

        test('6. 用户不存在于数据库中', async () => {
            // 创建一个用户，然后删除它
            const tempUsername = generateUniqueUsername('tempuser');
            const tempResponse = await request(server)
                .post('/login')
                .send({ username: tempUsername, password: 'password123' });
            
            const tempToken = tempResponse.body.token;
            
            // 删除用户
            const tempUser = await User.findByUsername(tempUsername);
            if (tempUser) {
                await User.delete(tempUser.id);
            }
            
            // 验证已删除用户的token
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ username: tempUsername, token: tempToken });
            
            expect(checkResponse.statusCode).toBe(401);
            expect(checkResponse.body.error).toBe('User not found');
            expect(checkResponse.body.valid).toBe(false);
        });

        test('7. 过期token验证', async () => {
            // 创建一个测试用户
            const validUsername = generateUniqueUsername('checktoken7');
            await request(server)
                .post('/login')
                .send({ username: validUsername, password: 'password123' });
            
            // 创建一个1秒后过期的token
            const expiredToken = jwt.sign(
                { id: 999, username: validUsername }, 
                config.SECRET_KEY, 
                { expiresIn: '1s' }
            );
            
            // 等待token过期
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ username: validUsername, token: expiredToken });
            
            expect(checkResponse.statusCode).toBe(401);
            expect(checkResponse.body.error).toBe('Token expired');
            expect(checkResponse.body.valid).toBe(false);
        });

        test('8. 空字符串参数', async () => {
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ username: '', token: '' });
            
            expect(checkResponse.statusCode).toBe(400);
            expect(checkResponse.body.error).toBe('Username and token are required');
        });

        test('9. 特殊字符username验证', async () => {
            const specialUsername = generateUniqueUsername('special_user_123');
            const specialResponse = await request(server)
                .post('/login')
                .send({ username: specialUsername, password: 'password123' });
            
            const specialToken = specialResponse.body.token;
            
            const checkResponse = await request(server)
                .get('/login/checkToken')
                .query({ username: specialUsername, token: specialToken });
            
            expect(checkResponse.statusCode).toBe(200);
            expect(checkResponse.body.valid).toBe(true);
            expect(checkResponse.body.username).toBe(specialUsername);
        });
    });
});