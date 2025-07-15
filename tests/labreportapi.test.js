const request = require('supertest');
const { app } = require('../index');
const { User } = require('../models/user');
const { Workspace } = require('../models/workspace');
const { LabReport } = require('../models/labreport');
const { LabReportItem } = require('../models/labreportitem');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// 生成唯一用户名
function generateUniqueUsername(prefix = 'testuser') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}_${timestamp}_${random}`;
}

describe('LabReport API Router Tests', () => {
    let testUser;
    let testWorkspace;
    let testLabReport;
    let testLabReportItem;
    let authToken;
    let server;

    beforeAll(async () => {
        // 启动测试服务器
        const PORT = 3004; // 使用不同的端口避免冲突
        server = app.listen(PORT);
    });

    afterAll(async () => {
        // 关闭测试服务器
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    beforeEach(async () => {
        // 在每个测试前创建测试用户
        testUser = await User.create(generateUniqueUsername('labreport_api'), 'password123');
        
        // 生成认证token
        authToken = jwt.sign(
            { id: testUser.id, username: testUser.username }, 
            config.SECRET_KEY, 
            { expiresIn: '1h' }
        );

        // 在每个测试前创建工作空间
        testWorkspace = await Workspace.create({
            name: `Test Workspace ${Date.now()}`,
            userId: testUser.id
        });
    });

    afterEach(async () => {
        if (testUser) {
            await User.delete(testUser.id);
            testUser = null;
        }
    });

    describe('POST /labreport - 创建检验报告', () => {
        it('应该成功创建检验报告', async () => {
            const labReportData = {
                patient: '张三',
                reportTime: new Date().toISOString(),
                doctor: '李医生',
                hospital: '人民医院',
                workspaceId: testWorkspace.id,
                items: [
                    {
                        itemName: '血常规',
                        result: '正常',
                        unit: 'g/L',
                        referenceValue: '3.5-5.5'
                    }
                ]
            };

            const response = await request(server)
                .post('/labreport')
                .set('Authorization', `Bearer ${authToken}`)
                .send(labReportData)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.patient).toBe('张三');
            expect(response.body.doctor).toBe('李医生');
            expect(response.body.hospital).toBe('人民医院');
            expect(response.body.workspaceId).toBe(testWorkspace.id);
            expect(response.body.items).toBeDefined();
            expect(response.body.items).toHaveLength(1);
            expect(response.body.items[0].itemName).toBe('血常规');

            testLabReport = response.body;
        });

        it('应该拒绝未认证的请求', async () => {
            const response = await request(server)
                .post('/labreport')
                .send({
                    patient: '张三',
                    reportTime: new Date().toISOString(),
                    workspaceId: testWorkspace.id
                })
                .expect(401);
        });

        it('应该验证必需字段', async () => {
            const response = await request(server)
                .post('/labreport')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    patient: '',
                    workspaceId: testWorkspace.id
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /labreport/count/:workspaceId - 获取检验报告数量', () => {
        beforeEach(async () => {
            // 创建测试检验报告
            testLabReport = await LabReport.createWithItems({
                patient: '张三',
                reportTime: new Date(),
                doctor: '李医生',
                hospital: '人民医院',
                workspaceId: testWorkspace.id
            });
        });

        it('应该返回正确的数量', async () => {
            const response = await request(server)
                .get(`/labreport/count/${testWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('count');
            expect(typeof response.body.count).toBe('number');
            expect(response.body.count).toBeGreaterThanOrEqual(1);
        });

        it('应该拒绝访问其他用户的工作空间', async () => {
            // 创建另一个用户和工作空间
            const otherUser = await User.create(generateUniqueUsername('otheruser'), 'password123');
            const otherWorkspace = await Workspace.create({
                name: 'Other Workspace',
                userId: otherUser.id
            });

            const response = await request(server)
                .get(`/labreport/count/${otherWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(403);

            // 清理
            await Workspace.delete(otherWorkspace.id);
            await User.delete(otherUser.id);
        });
    });

    describe('GET /labreport/workspace/:workspaceId - 获取工作空间检验报告列表', () => {
        beforeEach(async () => {
            // 创建测试检验报告
            testLabReport = await LabReport.createWithItems({
                patient: '张三',
                reportTime: new Date(),
                doctor: '李医生',
                hospital: '人民医院',
                workspaceId: testWorkspace.id
            });
        });

        it('应该返回检验报告列表', async () => {
            const response = await request(server)
                .get(`/labreport/workspace/${testWorkspace.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('id');
            expect(response.body[0]).toHaveProperty('patient');
            expect(response.body[0].patient).toBe('张三');
        });
    });

    describe('GET /labreport/workspace/:workspaceId/paginated - 分页获取检验报告', () => {
        beforeEach(async () => {
            // 创建30个测试检验报告，使用不同的reportTime确保排序可预测
            for (let i = 0; i < 30; i++) {
                await LabReport.createWithItems({    
                    patient: `张三${i}`,
                    reportTime: new Date(Date.now() - i * 1000), // 每个报告时间递减1秒
                    doctor: '李医生',
                    hospital: '人民医院',
                    workspaceId: testWorkspace.id
                });
            }
        });

        it('应该返回分页结果', async () => {
            const response = await request(server)
                .get(`/labreport/workspace/${testWorkspace.id}/paginated?page=1&pageSize=20`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('reports');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.reports)).toBe(true);
            expect(response.body.pagination.totalCount).toBe(30);
            expect(response.body.pagination.totalPages).toBe(2);
            expect(response.body.pagination.pageSize).toBe(20);
            expect(response.body.pagination.currentPage).toBe(1);
            expect(response.body.reports[0].patient).toBe('张三0');
            expect(response.body.reports[19].patient).toBe('张三19');
            expect(response.body.reports.length).toBe(20);
            expect(response.body.pagination.hasNext).toBe(true);
            expect(response.body.pagination.hasPrev).toBe(false);

            const response2 = await request(server)
                .get(`/labreport/workspace/${testWorkspace.id}/paginated?page=2&pageSize=20`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response2.body).toHaveProperty('reports');
            expect(response2.body).toHaveProperty('pagination');
            expect(Array.isArray(response2.body.reports)).toBe(true);
            expect(response2.body.pagination.totalCount).toBe(30);
            expect(response2.body.pagination.totalPages).toBe(2);
            expect(response2.body.pagination.pageSize).toBe(20);
            expect(response2.body.pagination.currentPage).toBe(2);
            expect(response2.body.reports[0].patient).toBe('张三20');
            expect(response2.body.reports[9].patient).toBe('张三29');
            expect(response2.body.reports.length).toBe(10);
            expect(response2.body.pagination.hasNext).toBe(false);
            expect(response2.body.pagination.hasPrev).toBe(true);
        });
    });

    describe('GET /labreport/:id - 获取单个检验报告（包含项目）', () => {
        beforeEach(async () => {
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
                        referenceValue: '3.5-5.5'
                    }
                ]
            });
        });

        it('应该返回检验报告及其项目', async () => {
            const response = await request(server)
                .get(`/labreport/${testLabReport.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('items');
            expect(Array.isArray(response.body.items)).toBe(true);
            expect(response.body.items.length).toBeGreaterThan(0);
            expect(response.body.items[0]).toHaveProperty('itemName');
            expect(response.body.items[0].itemName).toBe('血常规');
        });

        it('应该返回404当检验报告不存在', async () => {
            const response = await request(server)
                .get('/labreport/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });

    describe('PUT /labreport/:id - 更新检验报告', () => {
        beforeEach(async () => {
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
                        referenceValue: '3.5-5.5'
                    }
                ]
            });
        });

        it('应该成功更新检验报告', async () => {
            const updateData = {
                patient: '李四',
                doctor: '王医生',
                hospital: '中心医院'
            };

            const response = await request(server)
                .put(`/labreport/${testLabReport.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.patient).toBe('李四');
            expect(response.body.doctor).toBe('王医生');
            expect(response.body.hospital).toBe('中心医院');
        });

        it('应该允许将doctor和hospital设置为null', async () => {
            const updateData = {
                doctor: null,
                hospital: null
            };

            const response = await request(server)
                .put(`/labreport/${testLabReport.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.doctor).toBeNull();
            expect(response.body.hospital).toBeNull();
        });
    });

    describe('POST /labreport/search - 搜索检验报告', () => {
        beforeEach(async () => {
            // 创建4名患者，每个患者创建三个检验报告，每个检验报告包含一个血常规和一个尿常规，每个检验报告时间递减1天
            const patients = ['张三', '李四', '王五', '赵六'];
            const items = ['血常规', '尿常规'];
            const results = ['正常', '异常'];
            const units = ['g/L', 'mmol/L'];
            const referenceValues = ['3.5-5.5', '1.0-1.5'];

            const labReportsData = [];
            for (const patient of patients) {   
                for (let i = 0; i < 3; i++) {
                    const reportTime = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                    const reportData = {
                        patient: patient,
                        reportTime: reportTime,
                        doctor: '李医生',
                        hospital: '人民医院',
                        workspaceId: testWorkspace.id,
                        items: items.map((item, index) => ({
                            itemName: item,
                            result: results[i % results.length],
                            unit: units[i % units.length],
                            referenceValue: referenceValues[i % referenceValues.length]
                        }))
                    };
                    labReportsData.push(reportData);
                }
            }
            
            // 批量创建检验报告和检验项目
            await LabReport.createBatchWithItems(labReportsData);
        });

        it('应该根据患者姓名搜索', async () => {
            const searchData = {
                workspaceId: testWorkspace.id,
                patients: ['李四'],
                itemNames: ['all'],
                page: 1,
                pageSize: 2
            };

            const response = await request(server)
                .post('/labreport/search')
                .set('Authorization', `Bearer ${authToken}`)
                .send(searchData)
                .expect(200);

            expect(response.body).toHaveProperty('reports');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.reports)).toBe(true);
            expect(response.body.reports.length).toBe(2);
            expect(response.body.reports[0].patient).toBe('李四');
            expect(response.body.reports[1].patient).toBe('李四');
            expect(response.body.pagination.totalCount).toBe(3);
            expect(response.body.pagination.totalPages).toBe(2);
            expect(response.body.pagination.pageSize).toBe(2);
            expect(response.body.pagination.currentPage).toBe(1);
            expect(response.body.pagination.hasNext).toBe(true);
            expect(response.body.pagination.hasPrev).toBe(false);
            console.log(response.body.reports[0].items);
            expect(response.body.reports[0].items.length).toBe(2);
        });

        it('应该根据项目名称过滤', async () => {
            const searchData = {
                workspaceId: testWorkspace.id,
                patients: ['王五'],
                itemNames: ['血常规'],
                page: 1,
                pageSize: 2
            };

            const response = await request(server)
                .post('/labreport/search')
                .set('Authorization', `Bearer ${authToken}`)
                .send(searchData)
                .expect(200);

            expect(response.body).toHaveProperty('reports');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.reports)).toBe(true);
            expect(response.body.reports.length).toBe(2);
            expect(response.body.reports[0].patient).toBe('王五');
            expect(response.body.reports[1].patient).toBe('王五');
            expect(response.body.reports[0].items.length).toBe(1);
            expect(response.body.reports[0].items[0].itemName).toBe('血常规');

            const searchData2 = {
                workspaceId: testWorkspace.id,
                patients: ['王五'],
                itemNames: ['尿常规'],
                page: 2,
                pageSize: 2
            };

            const response2 = await request(server)
                .post('/labreport/search')
                .set('Authorization', `Bearer ${authToken}`)
                .send(searchData2)
                .expect(200);

            expect(response2.body).toHaveProperty('reports');
            expect(response2.body).toHaveProperty('pagination');
            expect(Array.isArray(response2.body.reports)).toBe(true);
            expect(response2.body.reports.length).toBe(1);
            expect(response2.body.reports[0].patient).toBe('王五');
            expect(response2.body.reports[0].items.length).toBe(1);
            expect(response2.body.reports[0].items[0].itemName).toBe('尿常规');
            expect(response2.body.pagination.totalCount).toBe(3);
            expect(response2.body.pagination.totalPages).toBe(2);
            expect(response2.body.pagination.pageSize).toBe(2);
            expect(response2.body.pagination.currentPage).toBe(2);
            expect(response2.body.pagination.hasNext).toBe(false);
            expect(response2.body.pagination.hasPrev).toBe(true);
        });

        it('应该根据日期范围过滤', async () => {
            const searchData = {
                workspaceId: testWorkspace.id,
                patients: ['all'],
                itemNames: ['all'],
                startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                page: 1,
                pageSize: 10
            };

            const response = await request(server)
                .post('/labreport/search')  
                .set('Authorization', `Bearer ${authToken}`)
                .send(searchData)
                .expect(200);

            expect(response.body).toHaveProperty('reports');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.reports)).toBe(true);
            expect(response.body.reports.length).toBe(4);
            const patientNames = response.body.reports.map(report => report.patient);
            expect(patientNames).toContain('张三');
            expect(patientNames).toContain('李四');
            expect(patientNames).toContain('王五');
            expect(patientNames).toContain('赵六');
            expect(response.body.reports[0].items.length).toBe(2);
        });
    });


    describe('DELETE /labreport/:id - 删除检验报告', () => {
        beforeEach(async () => {
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
                        referenceValue: '3.5-5.5'
                    }
                ]
            });
        });

        it('应该成功删除检验报告及其项目', async () => {
            const response = await request(server)
                .delete(`/labreport/${testLabReport.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe('检验报告删除成功');

            // 验证检验报告已被删除
            const deletedReport = await LabReport.findById(testLabReport.id);
            expect(deletedReport).toBeNull();

            // 验证关联的检验项目也被删除
            const deletedItems = await LabReportItem.findByLabReportId(testLabReport.id);
            expect(deletedItems.length).toBe(0);
        });

        it('应该返回404当检验报告不存在', async () => {
            const response = await request(server)
                .delete('/labreport/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });
}); 