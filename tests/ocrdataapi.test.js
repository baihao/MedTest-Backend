const request = require('supertest');
const { app } = require('../index');
const { User } = require('../models/user');
const { Workspace } = require('../models/workspace');
const { OcrData } = require('../models/ocrdata');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { generateUniqueUsername } = require('./utils');

describe('OCR Data API Router Tests', () => {
    let testUser;
    let testWorkspace;
    let authToken;
    let server;

    beforeAll(async () => {
        // 初始化模型
        await User.init();
        await Workspace.init();
        await OcrData.init();
        
        // 启动测试服务器
        const PORT = 3003; // 使用不同的端口避免冲突
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

        // 生成认证令牌
        authToken = jwt.sign(
            { id: testUser.id, username: testUser.username },
            config.SECRET_KEY,
            { expiresIn: '1h' }
        );
    });

    afterEach(async () => {
        // 清理测试数据
        if (OcrData.model) {
            await OcrData.model.destroy({ where: {}, force: true });
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

    describe('POST /ocrdata/batch/:workspaceId - 批量上传OCR数据到指定工作空间', () => {
        it('应该成功批量上传OCR数据到指定工作空间', async () => {
            const ocrDataArray = [
                {
                    reportImage: 'path/to/image1.jpg',
                    ocrPrimitive: 'OCR识别结果1'
                },
                {
                    reportImage: 'path/to/image2.jpg',
                    ocrPrimitive: 'OCR识别结果2'
                }
            ];

            const response = await request(server)
                .post(`/ocrdata/batch/${testWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ ocrDataArray })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('批量上传成功');
            expect(response.body.data.createdCount).toBe(2);
            expect(response.body.data.workspaceId).toBe(testWorkspace.id);
            expect(response.body.data.workspaceName).toBe(testWorkspace.name);
            expect(response.body.data.ocrData).toHaveLength(2);
            expect(response.body.data.ocrData[0].reportImage).toBe('path/to/image1.jpg');
            expect(response.body.data.ocrData[0].ocrPrimitive).toBe('OCR识别结果1');
            expect(response.body.data.ocrData[1].reportImage).toBe('path/to/image2.jpg');
            expect(response.body.data.ocrData[1].ocrPrimitive).toBe('OCR识别结果2');
        });

        it('应该拒绝未认证的请求', async () => {
            const response = await request(server)
                .post(`/ocrdata/batch/${testWorkspace.id}`)
                .send({
                    ocrDataArray: [{
                        reportImage: 'test.jpg',
                        ocrPrimitive: 'test ocr'
                    }]
                })
                .expect(401);
        });

        it('应该验证请求体格式', async () => {
            const response = await request(server)
                .post(`/ocrdata/batch/${testWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('OCR数据数组是必需的');
        });

        it('应该拒绝空数组', async () => {
            const response = await request(server)
                .post(`/ocrdata/batch/${testWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ ocrDataArray: [] })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('OCR数据数组不能为空');
        });

        it('应该限制批量上传数量', async () => {
            const largeArray = Array.from({ length: 101 }, (_, i) => ({
                reportImage: `path/to/image${i}.jpg`,
                ocrPrimitive: `OCR识别结果${i}`
            }));

            const response = await request(server)
                .post(`/ocrdata/batch/${testWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ ocrDataArray: largeArray })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('批量上传数量不能超过100条');
        });

        it('应该拒绝访问不存在的工作空间', async () => {
            const response = await request(server)
                .post('/ocrdata/batch/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ocrDataArray: [{
                        reportImage: 'test.jpg',
                        ocrPrimitive: 'test ocr'
                    }]
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('工作空间不存在');
        });

        it('应该拒绝访问其他用户的工作空间', async () => {
            // 创建另一个用户和工作空间
            const otherUser = await User.create(generateUniqueUsername('otheruser'), 'password123');
            const otherWorkspace = await Workspace.create({
                name: 'Other Workspace',
                userId: otherUser.id
            });

            const response = await request(server)
                .post(`/ocrdata/batch/${otherWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ocrDataArray: [{
                        reportImage: 'test.jpg',
                        ocrPrimitive: 'test ocr'
                    }]
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('没有权限访问该工作空间');

            // 清理
            await Workspace.delete(otherWorkspace.id);
            await User.delete(otherUser.id);
        });
    });

    describe('GET /ocrdata/workspace/:workspaceId - 获取工作空间的OCR数据列表', () => {
        beforeEach(async () => {
            // 创建一些测试OCR数据
            const ocrDataArray = [
                {
                    reportImage: 'path/to/image1.jpg',
                    ocrPrimitive: 'OCR识别结果1',
                    workspaceId: testWorkspace.id
                },
                {
                    reportImage: 'path/to/image2.jpg',
                    ocrPrimitive: 'OCR识别结果2',
                    workspaceId: testWorkspace.id
                }
            ];
            await OcrData.createBatch(ocrDataArray);
        });

        it('应该成功获取工作空间的OCR数据列表', async () => {
            const response = await request(server)
                .get(`/ocrdata/workspace/${testWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.workspaceId).toBe(testWorkspace.id);
            expect(response.body.data.totalCount).toBe(2);
            expect(response.body.data.ocrData).toHaveLength(2);
            const reportImages = response.body.data.ocrData.map(item => item.reportImage);
            expect(reportImages).toEqual(expect.arrayContaining(['path/to/image1.jpg', 'path/to/image2.jpg']));
        });

        it('应该支持分页参数', async () => {
            const response = await request(server)
                .get(`/ocrdata/workspace/${testWorkspace.id}?limit=1&offset=0`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data.limit).toBe(1);
            expect(response.body.data.offset).toBe(0);
            expect(response.body.data.ocrData).toHaveLength(1);
        });

        it('应该拒绝访问不存在的工作空间', async () => {
            const response = await request(server)
                .get('/ocrdata/workspace/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('工作空间不存在');
        });

        it('应该拒绝访问其他用户的工作空间', async () => {
            // 创建另一个用户和工作空间
            const otherUser = await User.create(generateUniqueUsername('otheruser'), 'password123');
            const otherWorkspace = await Workspace.create({
                name: 'Other Workspace',
                userId: otherUser.id
            });

            const response = await request(server)
                .get(`/ocrdata/workspace/${otherWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('没有权限访问该工作空间');

            // 清理
            await Workspace.delete(otherWorkspace.id);
            await User.delete(otherUser.id);
        });
    });

    describe('GET /ocrdata/:id - 获取单个OCR数据详情', () => {
        let testOcrData;

        beforeEach(async () => {
            // 创建测试OCR数据
            testOcrData = await OcrData.create({
                reportImage: 'path/to/test.jpg',
                ocrPrimitive: '测试OCR结果',
                workspaceId: testWorkspace.id
            });
        });

        it('应该成功获取单个OCR数据详情', async () => {
            const response = await request(server)
                .get(`/ocrdata/${testOcrData.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(testOcrData.id);
            expect(response.body.data.reportImage).toBe('path/to/test.jpg');
            expect(response.body.data.ocrPrimitive).toBe('测试OCR结果');
            expect(response.body.data.workspaceId).toBe(testWorkspace.id);
            expect(response.body.data.workspaceName).toBe(testWorkspace.name);
        });

        it('应该返回404当OCR数据不存在时', async () => {
            const response = await request(server)
                .get('/ocrdata/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('OCR数据不存在');
        });

        it('应该拒绝访问其他用户的OCR数据', async () => {
            // 创建另一个用户和工作空间
            const otherUser = await User.create(generateUniqueUsername('otheruser'), 'password123');
            const otherWorkspace = await Workspace.create({
                name: 'Other Workspace',
                userId: otherUser.id
            });

            const otherOcrData = await OcrData.create({
                reportImage: 'path/to/other.jpg',
                ocrPrimitive: '其他OCR结果',
                workspaceId: otherWorkspace.id
            });

            const response = await request(server)
                .get(`/ocrdata/${otherOcrData.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('没有权限访问该OCR数据');

            // 清理
            await Workspace.delete(otherWorkspace.id);
            await User.delete(otherUser.id);
        });
    });

    describe('DELETE /ocrdata/batch - 批量删除OCR数据', () => {
        let testOcrData1, testOcrData2;

        beforeEach(async () => {
            // 创建测试OCR数据
            testOcrData1 = await OcrData.create({
                reportImage: 'path/to/image1.jpg',
                ocrPrimitive: 'OCR结果1',
                workspaceId: testWorkspace.id
            });

            testOcrData2 = await OcrData.create({
                reportImage: 'path/to/image2.jpg',
                ocrPrimitive: 'OCR结果2',
                workspaceId: testWorkspace.id
            });
        });

        it('应该成功批量删除OCR数据', async () => {
            const response = await request(server)
                .delete('/ocrdata/batch')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ idArray: [testOcrData1.id, testOcrData2.id] })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('批量删除成功');
            expect(response.body.data.deletedCount).toBe(2);
            expect(response.body.data.deletedIds).toContain(testOcrData1.id);
            expect(response.body.data.deletedIds).toContain(testOcrData2.id);
        });

        it('应该验证请求体格式', async () => {
            const response = await request(server)
                .delete('/ocrdata/batch')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('ID数组是必需的');
        });

        it('应该拒绝空数组', async () => {
            const response = await request(server)
                .delete('/ocrdata/batch')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ idArray: [] })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('ID数组不能为空');
        });

        it('应该限制批量删除数量', async () => {
            const largeArray = Array.from({ length: 101 }, (_, i) => i + 1);

            const response = await request(server)
                .delete('/ocrdata/batch')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ idArray: largeArray })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('批量删除数量不能超过100条');
        });

        it('应该处理部分OCR数据不存在的情况', async () => {
            const response = await request(server)
                .delete('/ocrdata/batch')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ idArray: [testOcrData1.id, 99999] })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('部分OCR数据不存在');
        });

        it('应该拒绝删除其他用户的OCR数据', async () => {
            // 创建另一个用户和工作空间
            const otherUser = await User.create(generateUniqueUsername('otheruser'), 'password123');
            const otherWorkspace = await Workspace.create({
                name: 'Other Workspace',
                userId: otherUser.id
            });

            const otherOcrData = await OcrData.create({
                reportImage: 'path/to/other.jpg',
                ocrPrimitive: '其他OCR结果',
                workspaceId: otherWorkspace.id
            });

            const response = await request(server)
                .delete('/ocrdata/batch')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ idArray: [testOcrData1.id, otherOcrData.id] })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('没有权限删除部分OCR数据');

            // 清理
            await Workspace.delete(otherWorkspace.id);
            await User.delete(otherUser.id);
        });
    });
}); 