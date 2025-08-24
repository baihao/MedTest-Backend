const request = require('supertest');
const { app } = require('../index');
const { Workspace } = require('../models/workspace');
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../config/config');
const { User } = require('../models/user');
const { generateUniqueUsername, generateUniqueWorkspaceName } = require('./utils');

describe('Workspace API', () => {
    let testToken;
    let testUserId;
    let testUser;
    let server;

    beforeAll(async () => {
        // 启动测试服务器
        const PORT = 3003; // 使用不同的端口避免冲突
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
        testUserId = testUser.id;
        testToken = jwt.sign({ id: Number(testUserId) }, SECRET_KEY, { expiresIn: '1h' });
    });

    describe('POST /workspace/create', () => {
        it('应成功创建工作空间', async () => {
            const workspaceName = generateUniqueWorkspaceName('测试工作空间');
            const res = await request(server)
                .post('/workspace/create')
                .set('Authorization', testToken)
                .send({ name: workspaceName });

            // 临时添加错误信息输出
            if (res.statusCode === 500) {
                console.error('500错误详情:', res.body);
            }
            
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe(workspaceName);
            expect(res.body.userId).toBe(testUserId);
        });

        it('缺少name参数应返回400', async () => {
            const res = await request(server)
                .post('/workspace/create')
                .set('Authorization', testToken)
                .send({});
            
            expect(res.statusCode).toEqual(400);
        });

        it('不存在用户应返回404', async () => {
            let userId = 12333;
            invalidToken = jwt.sign({ id: userId }, SECRET_KEY, { expiresIn: '1h' });
            const res = await request(server)
                .post('/workspace/create')
                .set('Authorization', invalidToken)
                .send({ name: generateUniqueWorkspaceName('未认证工作空间') });
            
            // 临时添加错误信息输出
            if (res.statusCode === 500) {
                console.error('500错误详情:', res.body);
            }
            
            expect(res.statusCode).toEqual(404);
        });

        it('未认证用户应返回401', async () => {
            const res = await request(server)
                .post('/workspace/create')
                .send({ name: generateUniqueWorkspaceName('未认证工作空间') });
            
            expect(res.statusCode).toEqual(401);
        });
    });

    describe('GET /workspace', () => {
        let testWorkspaceId;
        beforeEach(async () => {
            const createRes = await request(server)
                .post('/workspace/create')
                .set('Authorization', testToken)
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            testWorkspaceId = createRes.body.id;
        });
        it('应返回用户的工作空间列表', async () => {
            const res = await request(server)
                .get('/workspace')
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBeTruthy();
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('未认证用户应返回401', async () => {
            const res = await request(server)
                .get('/workspace');
            
            expect(res.statusCode).toEqual(401);
        });
    });

    describe('POST /workspace/delete/:id', () => {
        let testWorkspaceId;
        beforeEach(async () => {
            const createRes = await request(server)
                .post('/workspace/create')
                .set('Authorization', testToken)
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            testWorkspaceId = createRes.body.id;
        });
        it('应成功删除工作空间', async () => {
            const res = await request(server)
                .post(`/workspace/delete/${testWorkspaceId}`)
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(200);
            expect(res.body.id).toBe(testWorkspaceId);
        });

        it('删除不存在的workspace应返回404', async () => {
            const res = await request(server)
                .post('/workspace/delete/99999')
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(404);
        });

        it('未认证用户应返回401', async () => {
            const res = await request(server)
                .post(`/workspace/delete/${testWorkspaceId}`);
            
            expect(res.statusCode).toEqual(401);
        });

        it('删除其他用户的工作空间应返回403', async () => {
            const user2 = await User.create(generateUniqueUsername('user2'), 'password');
            const user2WorkspaceId = await Workspace.create({
                name: generateUniqueWorkspaceName('其他用户的工作空间'),
                userId: user2.id
            });

            console.log(user2WorkspaceId.id);

            const res = await request(server)
                .post(`/workspace/delete/${Number(user2WorkspaceId.id)}`)
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(403);
        });
    });

    describe('GET /workspace/:id/patients', () => {
        let testWorkspaceId;
        let testLabReportId;

        beforeEach(async () => {
            // 创建工作空间
            const createRes = await request(server)
                .post('/workspace/create')
                .set('Authorization', testToken)
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            testWorkspaceId = createRes.body.id;

            // 创建实验室报告
            const { LabReport } = require('../models/labreport');
            const labReport = await LabReport.createWithItems({
                patient: '张三',
                reportTime: new Date(),
                doctor: '李医生',
                workspaceId: testWorkspaceId,
                items: []
            });
            testLabReportId = labReport.id;

            // 创建另一个实验室报告
            await LabReport.createWithItems({
                patient: '李四',
                reportTime: new Date(),
                doctor: '王医生',
                workspaceId: testWorkspaceId,
                items: []
            });

            // 创建第三个实验室报告（重复患者姓名）
            await LabReport.createWithItems({
                patient: '张三',
                reportTime: new Date(),
                doctor: '赵医生',
                workspaceId: testWorkspaceId,
                items: []
            });
        });

        it('应返回工作空间下所有患者姓名', async () => {
            const res = await request(server)
                .get(`/workspace/${testWorkspaceId}/patients`)
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('workspaceId', testWorkspaceId);
            expect(res.body).toHaveProperty('workspaceName');
            expect(res.body).toHaveProperty('patients');
            expect(Array.isArray(res.body.patients)).toBeTruthy();
            expect(res.body.patients).toContain('张三');
            expect(res.body.patients).toContain('李四');
            // 患者姓名应该去重并按字母顺序排序
            expect(res.body.patients).toEqual(['张三', '李四']);
        });

        it('访问不存在的工作空间应返回404', async () => {
            const res = await request(server)
                .get('/workspace/99999/patients')
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(404);
            expect(res.body.error).toBe('未找到对应workspace');
        });

        it('访问其他用户的工作空间应返回403', async () => {
            const user2 = await User.create(generateUniqueUsername('user2'), 'password');
            const user2Workspace = await Workspace.create({
                name: generateUniqueWorkspaceName('其他用户的工作空间'),
                userId: user2.id
            });

            const res = await request(server)
                .get(`/workspace/${user2Workspace.id}/patients`)
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(403);
            expect(res.body.error).toBe('无权访问此workspace');
        });

        it('未认证用户应返回401', async () => {
            const res = await request(server)
                .get(`/workspace/${testWorkspaceId}/patients`);
            
            expect(res.statusCode).toEqual(401);
        });
    });

    describe('GET /workspace/:id/report-items', () => {
        let testWorkspaceId;
        let testLabReportId;

        beforeEach(async () => {
            // 创建工作空间
            const createRes = await request(server)
                .post('/workspace/create')
                .set('Authorization', testToken)
                .send({ name: generateUniqueWorkspaceName('测试工作空间') });
            testWorkspaceId = createRes.body.id;

            // 创建实验室报告
            const { LabReport } = require('../models/labreport');
            const labReport = await LabReport.createWithItems({
                patient: '张三',
                reportTime: new Date(),
                doctor: '李医生',
                workspaceId: testWorkspaceId,
                items: []
            });
            testLabReportId = labReport.id;

            // 创建实验室报告项目
            const { LabReportItem } = require('../models/labreportitem');
            await LabReportItem.createBatch([
                {
                    labReportId: testLabReportId,
                    itemName: '白细胞计数',
                    result: '7.65',
                    unit: '10^9/L',
                    referenceValue: '3.5-9.5'
                },
                {
                    labReportId: testLabReportId,
                    itemName: '红细胞计数',
                    result: '4.8',
                    unit: '10^12/L',
                    referenceValue: '4.0-5.5'
                }
            ]);

            // 创建另一个实验室报告
            const labReport2 = await LabReport.createWithItems({
                patient: '李四',
                reportTime: new Date(),
                doctor: '王医生',
                workspaceId: testWorkspaceId,
                items: []
            });

            // 创建更多实验室报告项目
            await LabReportItem.createBatch([
                {
                    labReportId: labReport2.id,
                    itemName: '血红蛋白',
                    result: '145',
                    unit: 'g/L',
                    referenceValue: '130-175'
                },
                {
                    labReportId: labReport2.id,
                    itemName: '白细胞计数',
                    result: '6.2',
                    unit: '10^9/L',
                    referenceValue: '3.5-9.5'
                }
            ]);
        });

        it('应返回工作空间下所有报告项目名称', async () => {
            const res = await request(server)
                .get(`/workspace/${testWorkspaceId}/report-items`)
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('workspaceId', testWorkspaceId);
            expect(res.body).toHaveProperty('workspaceName');
            expect(res.body).toHaveProperty('reportItems');
            expect(Array.isArray(res.body.reportItems)).toBeTruthy();
            expect(res.body.reportItems).toContain('白细胞计数');
            expect(res.body.reportItems).toContain('红细胞计数');
            expect(res.body.reportItems).toContain('血红蛋白');
            // 项目名称应该去重并按字母顺序排序
            expect(res.body.reportItems).toEqual(['白细胞计数', '红细胞计数', '血红蛋白']);
        });

        it('访问不存在的工作空间应返回404', async () => {
            const res = await request(server)
                .get('/workspace/99999/report-items')
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(404);
            expect(res.body.error).toBe('未找到对应workspace');
        });

        it('访问其他用户的工作空间应返回403', async () => {
            const user2 = await User.create(generateUniqueUsername('user2'), 'password');
            const user2Workspace = await Workspace.create({
                name: generateUniqueWorkspaceName('其他用户的工作空间'),
                userId: user2.id
            });

            const res = await request(server)
                .get(`/workspace/${user2Workspace.id}/report-items`)
                .set('Authorization', testToken);
            
            expect(res.statusCode).toEqual(403);
            expect(res.body.error).toBe('无权访问此workspace');
        });

        it('未认证用户应返回401', async () => {
            const res = await request(server)
                .get(`/workspace/${testWorkspaceId}/report-items`);
            
            expect(res.statusCode).toEqual(401);
        });
    });
});