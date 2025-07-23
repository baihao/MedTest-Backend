const request = require('supertest');
const { app } = require('../index');
const { User } = require('../models/user');
const { Workspace } = require('../models/workspace');
const { LabReport } = require('../models/labreport');
const { LabReportItem } = require('../models/labreportitem');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { generateUniqueUsername } = require('./utils');

describe('LabReportItem API Router Tests', () => {
    let testUser;
    let testWorkspace;
    let testLabReport;
    let testLabReportItem;
    let authToken;
    let server;

    beforeAll(async () => {
        // 初始化模型
        await User.init();
        await Workspace.init();
        await LabReport.init();
        await LabReportItem.init();
        
        // 启动测试服务器
        const PORT = 3005; // 使用不同的端口避免冲突
        server = app.listen(PORT);
    });

    beforeEach(async () => {
        // 创建测试用户
        testUser = await User.create(generateUniqueUsername('testuser'), 'password123');
        
        // 创建测试工作空间
        testWorkspace = await Workspace.create({
            name: `Test Workspace ${Date.now()}`,
            userId: testUser.id
        });

        // 创建测试检验报告
        testLabReport = await LabReport.createWithItems({
            patient: '张三',
            reportTime: new Date(),
            doctor: '李医生',
            hospital: '人民医院',
            workspaceId: testWorkspace.id,
            items: [
                {
                    itemName: '血常规',
                    result: '正常',
                    unit: 'g/L',
                    referenceValue: '3.5-9.5'
                }
            ]
        });

        // 获取创建的检验报告项目
        testLabReportItem = testLabReport.items[0];

        // 生成认证令牌
        authToken = jwt.sign(
            { id: testUser.id, username: testUser.username },
            config.SECRET_KEY,
            { expiresIn: '1h' }
        );
    });

    afterEach(async () => {
        // 清理测试数据
        if (testLabReport) {
            await LabReport.delete(testLabReport.id);
            testLabReport = null;
        }
        if (testWorkspace) {
            await Workspace.delete(testWorkspace.id);
            testWorkspace = null;
        }
        if (testUser) {
            await User.delete(testUser.id);
            testUser = null;
        }
    });

    afterAll(async () => {
        // 关闭测试服务器
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    describe('GET /labreportitem/:id - 获取单个检验报告项目', () => {
        it('应该成功获取检验报告项目', async () => {
            const response = await request(server)
                .get(`/labreportitem/${testLabReportItem.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(testLabReportItem.id);
            expect(response.body.data.itemName).toBe('血常规');
            expect(response.body.data.result).toBe('正常');
            expect(response.body.data.unit).toBe('g/L');
            expect(response.body.data.referenceValue).toBe('3.5-9.5');
        });

        it('应该返回404当检验报告项目不存在', async () => {
            const response = await request(server)
                .get('/labreportitem/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('检验报告项目不存在');
        });

        it('应该拒绝未认证的请求', async () => {
            const response = await request(server)
                .get(`/labreportitem/${testLabReportItem.id}`)
                .expect(401);
        });
    });

    describe('PUT /labreportitem/:id - 更新检验报告项目', () => {
        it('应该成功更新检验报告项目', async () => {
            const updateData = {
                result: '异常',
                unit: 'mg/dL',
                referenceValue: '4.0-10.0'
            };

            const response = await request(server)
                .put(`/labreportitem/${testLabReportItem.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.result).toBe('异常');
            expect(response.body.data.unit).toBe('mg/dL');
            expect(response.body.data.referenceValue).toBe('4.0-10.0');
            expect(response.body.data.itemName).toBe('血常规'); // 未更新的字段保持不变
        });

        it('应该成功更新项目名称', async () => {
            const updateData = {
                itemName: '白细胞计数'
            };

            const response = await request(server)
                .put(`/labreportitem/${testLabReportItem.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.itemName).toBe('白细胞计数');
        });

        it('应该返回404当检验报告项目不存在', async () => {
            const updateData = { result: '异常' };

            const response = await request(server)
                .put('/labreportitem/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('检验报告项目不存在');
        });

        it('应该拒绝未认证的请求', async () => {
            const updateData = { result: '异常' };

            const response = await request(server)
                .put(`/labreportitem/${testLabReportItem.id}`)
                .send(updateData)
                .expect(401);
        });

        it('应该验证无效的ID格式', async () => {
            const updateData = { result: '异常' };

            const response = await request(server)
                .put('/labreportitem/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('检验报告项目ID必须是有效的数字');
        });
    });

    describe('DELETE /labreportitem/:id - 删除检验报告项目', () => {
        it('应该成功删除检验报告项目', async () => {
            const response = await request(server)
                .delete(`/labreportitem/${testLabReportItem.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(testLabReportItem.id);

            // 验证项目已被删除
            const getResponse = await request(server)
                .get(`/labreportitem/${testLabReportItem.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });

        it('应该返回404当检验报告项目不存在', async () => {
            const response = await request(server)
                .delete('/labreportitem/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('检验报告项目不存在');
        });

        it('应该拒绝未认证的请求', async () => {
            const response = await request(server)
                .delete(`/labreportitem/${testLabReportItem.id}`)
                .expect(401);
        });
    });
}); 