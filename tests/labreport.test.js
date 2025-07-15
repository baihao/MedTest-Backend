const request = require('supertest');
const { LabReport, LabReportError } = require('../models/labreport');
const { LabReportItem } = require('../models/labreportitem');
const { User } = require('../models/user');
const { Workspace } = require('../models/workspace');
const { ModelManager } = require('../models/modelmgr');
const { logger } = require('../config/logger');

// 创建测试服务器
let server;
let app;

// 生成唯一用户名
function generateUniqueUsername() {
    return `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 生成唯一工作空间名
function generateUniqueWorkspaceName() {
    return `testworkspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 生成唯一患者名
function generateUniquePatientName() {
    return `testpatient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

beforeAll(async () => {
    // 初始化数据库模型
    await ModelManager.init();
    
    // 创建Express应用
    app = require('express')();
    app.use(require('body-parser').json());
    
    // 启动服务器
    server = app.listen(3002, () => {
        logger.info('测试服务器启动在端口 3002');
    });
});

afterAll(async () => {
    // 关闭服务器
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    
    // 关闭数据库连接
    await ModelManager.close();
});

beforeEach(async () => {
    // 清理数据库
    await LabReportItem.model.destroy({ where: {} });
    await LabReport.model.destroy({ where: {} });
    await Workspace.model.destroy({ where: {} });
    await User.model.destroy({ where: {} });
});

describe('LabReport Model', () => {
    let testUser;
    let testWorkspace;
    
    beforeEach(async () => {
        // 创建测试用户
        testUser = await User.create(
            generateUniqueUsername(),
            'testpassword123'
        );
        
        // 创建测试工作空间
        testWorkspace = await Workspace.create({
            name: generateUniqueWorkspaceName(),
            description: 'Test workspace for lab reports',
            userId: testUser.id
        });
    });
    
    describe('create', () => {
        test('应该成功创建检验报告', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                reportImage: '/path/to/image.jpg',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.doctor).toBe(labReportData.doctor);
            expect(labReport.hospital).toBe(labReportData.hospital);
            expect(labReport.workspaceId).toBe(testWorkspace.id);
            expect(labReport.reportImage).toBe(labReportData.reportImage);
        });
        
        test('应该验证必需字段', async () => {
            const invalidData = {
                // 缺少必需字段
                reportImage: '/path/to/image.jpg'
            };
            
            await expect(LabReport.createWithItems(invalidData)).rejects.toThrow(LabReportError);
        });
        
        test('应该验证工作空间存在', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: 99999 // 不存在的ID
            };
            
            await expect(LabReport.createWithItems(labReportData)).rejects.toThrow(LabReportError);
        });
        
        test('应该验证字符串长度限制', async () => {
            const labReportData = {
                patient: 'a'.repeat(101), // 超过100字符
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            await expect(LabReport.createWithItems(labReportData)).rejects.toThrow(LabReportError);
        });
        
        test('应该允许doctor为空值', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: null, // doctor为空
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.doctor).toBeNull();
            expect(labReport.hospital).toBe(labReportData.hospital);
        });
        
        test('应该允许hospital为空值', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: null, // hospital为空
                workspaceId: testWorkspace.id
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.doctor).toBe(labReportData.doctor);
            expect(labReport.hospital).toBeNull();
        });
        
        test('应该允许doctor和hospital都为空值', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: null, // doctor为空
                hospital: null, // hospital为空
                workspaceId: testWorkspace.id
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.doctor).toBeNull();
            expect(labReport.hospital).toBeNull();
        });
        
        test('应该允许doctor为空字符串', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: '', // doctor为空字符串
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.doctor).toBeNull(); // 修正期望
            expect(labReport.hospital).toBe(labReportData.hospital);
        });
        
        test('应该允许hospital为空字符串', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: '', // hospital为空字符串
                workspaceId: testWorkspace.id
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.doctor).toBe(labReportData.doctor);
            expect(labReport.hospital).toBeNull(); // 修正期望
        });
        
        test('应该允许不提供doctor和hospital字段', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                // 不提供doctor和hospital字段
                workspaceId: testWorkspace.id
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.doctor).toBeNull();
            expect(labReport.hospital).toBeNull();
        });
    });

    describe('createWithItems', () => {
        test('应该成功创建检验报告并包含关联的检验项目', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id,
                items: [
                    {
                        itemName: '血常规',
                        result: '正常',
                        unit: 'g/L',
                        referenceValue: '3.5-5.5'
                    },
                    {
                        itemName: '血糖',
                        result: '5.2',
                        unit: 'mmol/L',
                        referenceValue: '3.9-6.1'
                    }
                ]
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.doctor).toBe(labReportData.doctor);
            expect(labReport.hospital).toBe(labReportData.hospital);
            expect(labReport.workspaceId).toBe(testWorkspace.id);
            expect(labReport.items).toBeDefined();
            expect(labReport.items).toHaveLength(2);
            expect(labReport.items[0].itemName).toBe('血常规');
            expect(labReport.items[1].itemName).toBe('血糖');
            
            // 验证检验项目已保存到数据库
            const { LabReportItem } = require('../models/labreportitem');
            const savedItems = await LabReportItem.findByLabReportId(labReport.id);
            expect(savedItems).toHaveLength(2);
            expect(savedItems[0].itemName).toBe('血常规');
            expect(savedItems[1].itemName).toBe('血糖');
        });
        
        test('应该成功创建检验报告但不包含检验项目', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
                // 不包含 items
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.id).toBeDefined();
            expect(labReport.patient).toBe(labReportData.patient);
            expect(labReport.items).toHaveLength(0);
        });
        
        test('应该验证检验项目数据格式', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id,
                items: [
                    {
                        itemName: '血常规',
                        result: '正常',
                        unit: 'g/L',
                        referenceValue: '3.5-5.5'
                    },
                    {
                        // 缺少 itemName
                        result: '异常',
                        unit: 'mg/dL',
                        referenceValue: '0-20'
                    }
                ]
            };
            
            await expect(LabReport.createWithItems(labReportData)).rejects.toThrow();
        });
        
        test('应该验证检验项目数组格式', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id,
                items: 'not an array' // 非数组格式
            };
            
            const labReport = await LabReport.createWithItems(labReportData);
            expect(labReport).toBeInstanceOf(LabReport);
            expect(labReport.items).toHaveLength(0);
        });
    });

    describe('createBatchWithItems', () => {
        test('应该成功批量创建检验报告和关联的检验项目', async () => {
            const labReportsData = [
                {
                    patient: generateUniquePatientName(),
                    reportTime: new Date(),
                    doctor: 'Dr. Smith',
                    hospital: 'Test Hospital',
                    workspaceId: testWorkspace.id,
                    items: [
                        {
                            itemName: '血常规',
                            result: '正常',
                            unit: 'g/L',
                            referenceValue: '3.5-5.5'
                        }
                    ]
                },
                {
                    patient: generateUniquePatientName(),
                    reportTime: new Date(),
                    doctor: 'Dr. Johnson',
                    hospital: 'Test Hospital',
                    workspaceId: testWorkspace.id,
                    items: [
                        {
                            itemName: '血糖',
                            result: '5.2',
                            unit: 'mmol/L',
                            referenceValue: '3.9-6.1'
                        },
                        {
                            itemName: '尿常规',
                            result: '异常',
                            unit: 'mg/dL',
                            referenceValue: '0-20'
                        }
                    ]
                }
            ];
            
            const labReports = await LabReport.createBatchWithItems(labReportsData);
            
            expect(Array.isArray(labReports)).toBe(true);
            expect(labReports).toHaveLength(2);
            expect(labReports[0]).toBeInstanceOf(LabReport);
            expect(labReports[1]).toBeInstanceOf(LabReport);
            
            // 验证第一个检验报告
            expect(labReports[0].patient).toBe(labReportsData[0].patient);
            expect(labReports[0].items).toHaveLength(1);
            expect(labReports[0].items[0].itemName).toBe('血常规');
            
            // 验证第二个检验报告
            expect(labReports[1].patient).toBe(labReportsData[1].patient);
            expect(labReports[1].items).toHaveLength(2);
            expect(labReports[1].items[0].itemName).toBe('血糖');
            expect(labReports[1].items[1].itemName).toBe('尿常规');
            
            // 验证检验项目已保存到数据库
            const { LabReportItem } = require('../models/labreportitem');
            const savedItems1 = await LabReportItem.findByLabReportId(labReports[0].id);
            const savedItems2 = await LabReportItem.findByLabReportId(labReports[1].id);
            
            expect(savedItems1).toHaveLength(1);
            expect(savedItems2).toHaveLength(2);
        });
        
        test('应该验证批量创建参数', async () => {
            // 测试 null 参数
            await expect(LabReport.createBatchWithItems(null)).rejects.toThrow(LabReportError);
            
            // 测试非数组参数
            await expect(LabReport.createBatchWithItems('not an array')).rejects.toThrow(LabReportError);
            
            // 测试空数组
            await expect(LabReport.createBatchWithItems([])).rejects.toThrow(LabReportError);
        });
        
        test('应该在事务失败时回滚所有操作', async () => {
            const labReportsData = [
                {
                    patient: generateUniquePatientName(),
                    reportTime: new Date(),
                    doctor: 'Dr. Smith',
                    hospital: 'Test Hospital',
                    workspaceId: testWorkspace.id,
                    items: [
                        {
                            itemName: '血常规',
                            result: '正常',
                            unit: 'g/L',
                            referenceValue: '3.5-5.5'
                        }
                    ]
                },
                {
                    patient: generateUniquePatientName(),
                    reportTime: new Date(),
                    doctor: 'Dr. Johnson',
                    hospital: 'Test Hospital',
                    workspaceId: 99999, // 不存在的workspaceId，会导致失败
                    items: [
                        {
                            itemName: '血糖',
                            result: '5.2',
                            unit: 'mmol/L',
                            referenceValue: '3.9-6.1'
                        }
                    ]
                }
            ];
            
            await expect(LabReport.createBatchWithItems(labReportsData)).rejects.toThrow(LabReportError);
            
            // 验证没有数据被创建
            const allReports = await LabReport.findByWorkspaceId(testWorkspace.id);
            expect(allReports).toHaveLength(0);
        });
        
        test('应该支持批量创建不包含检验项目的检验报告', async () => {
            const labReportsData = [
                {
                    patient: generateUniquePatientName(),
                    reportTime: new Date(),
                    doctor: 'Dr. Smith',
                    hospital: 'Test Hospital',
                    workspaceId: testWorkspace.id
                    // 不包含 items
                },
                {
                    patient: generateUniquePatientName(),
                    reportTime: new Date(),
                    doctor: 'Dr. Johnson',
                    hospital: 'Test Hospital',
                    workspaceId: testWorkspace.id,
                    items: [] // 空数组
                }
            ];
            
            const labReports = await LabReport.createBatchWithItems(labReportsData);
            
            expect(labReports).toHaveLength(2);
            expect(labReports[0]).toBeInstanceOf(LabReport);
            expect(labReports[1]).toBeInstanceOf(LabReport);
            expect(labReports[0].items).toHaveLength(0);
            expect(labReports[1].items).toHaveLength(0);
        });
    });

    describe('findById', () => {
        test('应该根据ID查找检验报告', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            const foundReport = await LabReport.findById(createdReport.id);
            
            expect(foundReport).toBeInstanceOf(LabReport);
            expect(foundReport.id).toBe(createdReport.id);
            expect(foundReport.patient).toBe(labReportData.patient);
        });
        
        test('应该返回null当检验报告不存在', async () => {
            const foundReport = await LabReport.findById(99999);
            expect(foundReport).toBeNull();
        });
        
        test('应该验证ID参数', async () => {
            await expect(LabReport.findById('invalid')).rejects.toThrow(LabReportError);
            await expect(LabReport.findById(null)).rejects.toThrow(LabReportError);
        });
    });

    describe('findByIdWithItems', () => {
        test('应该根据ID查找检验报告并包含关联的检验项目', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            // 创建关联的检验项目
            const item1 = await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
            
            const item2 = await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '血糖',
                result: '5.2',
                unit: 'mmol/L',
                referenceValue: '3.9-6.1'
            });
            
            const foundReport = await LabReport.findByIdWithItems(createdReport.id);
            
            expect(foundReport).toBeDefined();
            expect(foundReport.id).toBe(createdReport.id);
            expect(foundReport.patient).toBe(labReportData.patient);
            expect(foundReport.items).toBeDefined();
            expect(foundReport.items).toHaveLength(2);
            expect(foundReport.items[0].itemName).toBe('血常规');
            expect(foundReport.items[1].itemName).toBe('血糖');
        });
        
        test('应该返回null当检验报告不存在', async () => {
            const foundReport = await LabReport.findByIdWithItems(99999);
            expect(foundReport).toBeNull();
        });
        
        test('应该返回空items数组当没有关联的检验项目', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            const foundReport = await LabReport.findByIdWithItems(createdReport.id);
            
            expect(foundReport).toBeDefined();
            expect(foundReport.items).toHaveLength(0);
        });
    });
    
    describe('findByWorkspaceId', () => {
        test('应该根据工作空间ID查找检验报告', async () => {
            const labReportData1 = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData2 = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Johnson',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            await LabReport.createWithItems(labReportData1);
            await LabReport.createWithItems(labReportData2);
            
            const reports = await LabReport.findByWorkspaceId(testWorkspace.id);
            
            expect(reports).toHaveLength(2);
            expect(reports[0]).toBeInstanceOf(LabReport);
            expect(reports[1]).toBeInstanceOf(LabReport);
        });
        
        test('应该返回空数组当工作空间没有检验报告', async () => {
            const reports = await LabReport.findByWorkspaceId(testWorkspace.id);
            expect(reports).toHaveLength(0);
        });
        
        test('应该验证工作空间ID参数', async () => {
            await expect(LabReport.findByWorkspaceId('invalid')).rejects.toThrow(LabReportError);
        });
    });

    describe('findByWorkspaceIdWithPagination', () => {
        test('应该根据工作空间ID查找检验报告并支持分页', async () => {
            // 创建多个检验报告
            const reports = [];
            for (let i = 0; i < 25; i++) {
                const labReportData = {
                    patient: generateUniquePatientName(),
                    reportTime: new Date(),
                    doctor: `Dr. ${i}`,
                    hospital: 'Test Hospital',
                    workspaceId: testWorkspace.id
                };
                reports.push(await LabReport.createWithItems(labReportData));
            }
            
            // 测试第一页
            const result1 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 1, 10);
            expect(result1.reports).toHaveLength(10);
            expect(result1.pagination.currentPage).toBe(1);
            expect(result1.pagination.pageSize).toBe(10);
            expect(result1.pagination.totalCount).toBe(25);
            expect(result1.pagination.totalPages).toBe(3);
            expect(result1.pagination.hasNext).toBe(true);
            expect(result1.pagination.hasPrev).toBe(false);
            
            // 测试第二页
            const result2 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 2, 10);
            expect(result2.reports).toHaveLength(10);
            expect(result2.pagination.currentPage).toBe(2);
            expect(result2.pagination.hasNext).toBe(true);
            expect(result2.pagination.hasPrev).toBe(true);
            
            // 测试第三页
            const result3 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 3, 10);
            expect(result3.reports).toHaveLength(5);
            expect(result3.pagination.currentPage).toBe(3);
            expect(result3.pagination.hasNext).toBe(false);
            expect(result3.pagination.hasPrev).toBe(true);
        });

        test('应该支持分页获取100个检验报告', async () => {
            // 创建100个检验报告
            const reports = [];
            for (let i = 0; i < 100; i++) {
                const labReportData = {
                    patient: generateUniquePatientName(),
                    reportTime: new Date(),
                    doctor: `Dr. ${i}`,
                    hospital: 'Test Hospital',
                    workspaceId: testWorkspace.id
                };
                reports.push(await LabReport.createWithItems(labReportData));
            }
            
            // 测试默认分页（每页20个）
            const result1 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 1);
            expect(result1.reports).toHaveLength(20);
            expect(result1.pagination.currentPage).toBe(1);
            expect(result1.pagination.pageSize).toBe(20);
            expect(result1.pagination.totalCount).toBe(100);
            expect(result1.pagination.totalPages).toBe(5);
            expect(result1.pagination.hasNext).toBe(true);
            expect(result1.pagination.hasPrev).toBe(false);
            
            // 测试每页10个的分页
            const result2 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 1, 10);
            expect(result2.reports).toHaveLength(10);
            expect(result2.pagination.currentPage).toBe(1);
            expect(result2.pagination.pageSize).toBe(10);
            expect(result2.pagination.totalCount).toBe(100);
            expect(result2.pagination.totalPages).toBe(10);
            expect(result2.pagination.hasNext).toBe(true);
            expect(result2.pagination.hasPrev).toBe(false);
            
            // 测试每页50个的分页
            const result3 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 1, 50);
            expect(result3.reports).toHaveLength(50);
            expect(result3.pagination.currentPage).toBe(1);
            expect(result3.pagination.pageSize).toBe(50);
            expect(result3.pagination.totalCount).toBe(100);
            expect(result3.pagination.totalPages).toBe(2);
            expect(result3.pagination.hasNext).toBe(true);
            expect(result3.pagination.hasPrev).toBe(false);
            
            // 测试第二页（每页50个）
            const result4 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 2, 50);
            expect(result4.reports).toHaveLength(50);
            expect(result4.pagination.currentPage).toBe(2);
            expect(result4.pagination.pageSize).toBe(50);
            expect(result4.pagination.totalCount).toBe(100);
            expect(result4.pagination.totalPages).toBe(2);
            expect(result4.pagination.hasNext).toBe(false);
            expect(result4.pagination.hasPrev).toBe(true);
            
            // 测试最后一页（每页10个）
            const result5 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 10, 10);
            expect(result5.reports).toHaveLength(10);
            expect(result5.pagination.currentPage).toBe(10);
            expect(result5.pagination.pageSize).toBe(10);
            expect(result5.pagination.totalCount).toBe(100);
            expect(result5.pagination.totalPages).toBe(10);
            expect(result5.pagination.hasNext).toBe(false);
            expect(result5.pagination.hasPrev).toBe(true);
            
            // 测试中间页（每页10个）
            const result6 = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 5, 10);
            expect(result6.reports).toHaveLength(10);
            expect(result6.pagination.currentPage).toBe(5);
            expect(result6.pagination.pageSize).toBe(10);
            expect(result6.pagination.totalCount).toBe(100);
            expect(result6.pagination.totalPages).toBe(10);
            expect(result6.pagination.hasNext).toBe(true);
            expect(result6.pagination.hasPrev).toBe(true);
            
            // 验证所有报告都被正确创建和分页
            const allReports = await LabReport.findByWorkspaceId(testWorkspace.id);
            expect(allReports).toHaveLength(100);
            
            // 验证分页数据的完整性
            const allPaginatedReports = [];
            for (let page = 1; page <= 10; page++) {
                const pageResult = await LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, page, 10);
                allPaginatedReports.push(...pageResult.reports);
            }
            expect(allPaginatedReports).toHaveLength(100);
            
            // 验证所有报告都有唯一的ID
            const reportIds = allPaginatedReports.map(report => report.id);
            const uniqueIds = new Set(reportIds);
            expect(uniqueIds.size).toBe(100);
        });
        
        test('应该验证分页参数', async () => {
            await expect(LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 0, 10)).rejects.toThrow(LabReportError);
            await expect(LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 1, 0)).rejects.toThrow(LabReportError);
            await expect(LabReport.findByWorkspaceIdWithPagination(testWorkspace.id, 1, 101)).rejects.toThrow(LabReportError);
        });
    });

    describe('findByPatientsItemsAndDateRange', () => {
        test('应该根据患者姓名列表查找检验报告', async () => {
            const patient1 = generateUniquePatientName();
            const patient2 = generateUniquePatientName();
            
            const labReportData1 = {
                patient: patient1,
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData2 = {
                patient: patient2,
                reportTime: new Date(),
                doctor: 'Dr. Johnson',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            await LabReport.createWithItems(labReportData1);
            await LabReport.createWithItems(labReportData2);
            
            const result = await LabReport.findByPatientsItemsAndDateRange([patient1, patient2]);
            
            expect(result.reports).toHaveLength(2);
            expect(result.pagination.totalCount).toBe(2);
        });
        
        test('应该根据患者姓名列表和时间范围查找检验报告', async () => {
            const patient = generateUniquePatientName();
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');
            
            const labReportData1 = {
                patient: patient,
                reportTime: new Date('2024-06-15'),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData2 = {
                patient: patient,
                reportTime: new Date('2024-07-20'),
                doctor: 'Dr. Johnson',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            await LabReport.createWithItems(labReportData1);
            await LabReport.createWithItems(labReportData2);
            
            const result = await LabReport.findByPatientsItemsAndDateRange([patient], null, startDate, endDate);
            
            expect(result.reports).toHaveLength(2);
            expect(result.pagination.totalCount).toBe(2);
        });
        
        test('应该根据患者姓名列表、项目列表和时间范围查找检验报告并包含检验项目', async () => {
            const patient = generateUniquePatientName();
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');
            
            const labReportData = {
                patient: patient,
                reportTime: new Date('2024-06-15'),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            // 创建关联的检验项目
            await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
            
            await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '血糖',
                result: '5.2',
                unit: 'mmol/L',
                referenceValue: '3.9-6.1'
            });
            
            const result = await LabReport.findByPatientsItemsAndDateRange(
                [patient], 
                ['血常规'], 
                startDate, 
                endDate
            );
            
            expect(result.reports).toHaveLength(1);
            expect(result.reports[0].items).toHaveLength(1);
            expect(result.reports[0].items[0].itemName).toBe('血常规');
        });
        
        test('应该支持分页', async () => {
            const patient = generateUniquePatientName();
            
            // 创建多个检验报告
            for (let i = 0; i < 25; i++) {
                const labReportData = {
                    patient: patient,
                    reportTime: new Date(),
                    doctor: `Dr. ${i}`,
                    hospital: 'Test Hospital',
                    workspaceId: testWorkspace.id
                };
                await LabReport.createWithItems(labReportData);
            }
            
            const result = await LabReport.findByPatientsItemsAndDateRange([patient], null, null, null, null, 1, 10);
            
            expect(result.reports).toHaveLength(10);
            expect(result.pagination.currentPage).toBe(1);
            expect(result.pagination.totalCount).toBe(25);
            expect(result.pagination.totalPages).toBe(3);
        });
        
        test('应该验证患者姓名列表参数', async () => {
            await expect(LabReport.findByPatientsItemsAndDateRange(null)).rejects.toThrow(LabReportError);
            await expect(LabReport.findByPatientsItemsAndDateRange([])).rejects.toThrow(LabReportError);
            await expect(LabReport.findByPatientsItemsAndDateRange('not an array')).rejects.toThrow(LabReportError);
        });
        
        test('应该验证分页参数', async () => {
            const patient = generateUniquePatientName();
            await expect(LabReport.findByPatientsItemsAndDateRange([patient], null, null, null, null, 0, 10)).rejects.toThrow(LabReportError);
            await expect(LabReport.findByPatientsItemsAndDateRange([patient], null, null, null, null, 1, 0)).rejects.toThrow(LabReportError);
            await expect(LabReport.findByPatientsItemsAndDateRange([patient], null, null, null, null, 1, 101)).rejects.toThrow(LabReportError);
        });

        test('应该支持获取所有患者的检验报告', async () => {
            const patient1 = generateUniquePatientName();
            const patient2 = generateUniquePatientName();
            const patient3 = generateUniquePatientName();
            
            // 创建多个患者的检验报告
            const labReportData1 = {
                patient: patient1,
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData2 = {
                patient: patient2,
                reportTime: new Date(),
                doctor: 'Dr. Johnson',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData3 = {
                patient: patient3,
                reportTime: new Date(),
                doctor: 'Dr. Brown',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            await LabReport.createWithItems(labReportData1);
            await LabReport.createWithItems(labReportData2);
            await LabReport.createWithItems(labReportData3);
            
            // 使用 ['all'] 获取所有患者的检验报告
            const result = await LabReport.findByPatientsItemsAndDateRange(['all']);
            
            expect(result.reports).toHaveLength(3);
            expect(result.pagination.totalCount).toBe(3);
            
            // 验证包含所有患者的检验报告
            const patientNames = result.reports.map(report => report.patient);
            expect(patientNames).toContain(patient1);
            expect(patientNames).toContain(patient2);
            expect(patientNames).toContain(patient3);
        });

        test('应该支持获取所有项目的检验报告', async () => {
            const patient = generateUniquePatientName();
            
            const labReportData = {
                patient: patient,
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            // 创建多个检验项目
            await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
            
            await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '血糖',
                result: '5.2',
                unit: 'mmol/L',
                referenceValue: '3.9-6.1'
            });
            
            await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '尿常规',
                result: '异常',
                unit: 'mg/dL',
                referenceValue: '0-20'
            });
            
            // 使用 ['all'] 获取所有项目的检验报告
            const result = await LabReport.findByPatientsItemsAndDateRange([patient], ['all']);
            
            expect(result.reports).toHaveLength(1);
            expect(result.reports[0].items).toHaveLength(3);
            
            // 验证包含所有项目
            const itemNames = result.reports[0].items.map(item => item.itemName);
            expect(itemNames).toContain('血常规');
            expect(itemNames).toContain('血糖');
            expect(itemNames).toContain('尿常规');
        });

        test('应该支持获取所有患者和所有项目的检验报告', async () => {
            const patient1 = generateUniquePatientName();
            const patient2 = generateUniquePatientName();
            
            // 创建第一个患者的检验报告
            const labReportData1 = {
                patient: patient1,
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport1 = await LabReport.createWithItems(labReportData1);
            
            // 为第一个患者创建检验项目
            await LabReportItem.create({
                labReportId: createdReport1.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
            
            await LabReportItem.create({
                labReportId: createdReport1.id,
                itemName: '血糖',
                result: '5.2',
                unit: 'mmol/L',
                referenceValue: '3.9-6.1'
            });
            
            // 创建第二个患者的检验报告
            const labReportData2 = {
                patient: patient2,
                reportTime: new Date(),
                doctor: 'Dr. Johnson',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport2 = await LabReport.createWithItems(labReportData2);
            
            // 为第二个患者创建检验项目
            await LabReportItem.create({
                labReportId: createdReport2.id,
                itemName: '尿常规',
                result: '异常',
                unit: 'mg/dL',
                referenceValue: '0-20'
            });
            
            // 使用 ['all'] 获取所有患者和所有项目的检验报告
            const result = await LabReport.findByPatientsItemsAndDateRange(['all'], ['all']);
            
            expect(result.reports).toHaveLength(2);
            expect(result.pagination.totalCount).toBe(2);
            
            // 验证包含所有患者
            const patientNames = result.reports.map(report => report.patient);
            expect(patientNames).toContain(patient1);
            expect(patientNames).toContain(patient2);
            
            // 验证每个报告都包含其所有项目
            const report1 = result.reports.find(report => report.patient === patient1);
            const report2 = result.reports.find(report => report.patient === patient2);
            
            expect(report1.items).toHaveLength(2);
            expect(report2.items).toHaveLength(1);
            
            const report1ItemNames = report1.items.map(item => item.itemName);
            const report2ItemNames = report2.items.map(item => item.itemName);
            
            expect(report1ItemNames).toContain('血常规');
            expect(report1ItemNames).toContain('血糖');
            expect(report2ItemNames).toContain('尿常规');
        });

        test('应该正确处理 patients 包含 all 但 itemNames 为 null 的情况', async () => {
            const patient1 = generateUniquePatientName();
            const patient2 = generateUniquePatientName();
            
            const labReportData1 = {
                patient: patient1,
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData2 = {
                patient: patient2,
                reportTime: new Date(),
                doctor: 'Dr. Johnson',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            await LabReport.createWithItems(labReportData1);
            await LabReport.createWithItems(labReportData2);
            
            // 使用 ['all'] 获取所有患者，但不获取项目
            const result = await LabReport.findByPatientsItemsAndDateRange(['all'], null);
            
            expect(result.reports).toHaveLength(2);
            expect(result.pagination.totalCount).toBe(2);
            
            // 验证不包含 items 字段
            expect(result.reports[0].items).toBeUndefined();
            expect(result.reports[1].items).toBeUndefined();
        });

        test('应该验证 itemNames 参数格式', async () => {
            const patient = generateUniquePatientName();
            
            // 创建测试数据
            const labReportData = {
                patient: patient,
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            // 创建关联的检验项目
            await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
            
            // 测试 itemNames 为空数组 - 应该不获取任何项目
            const result = await LabReport.findByPatientsItemsAndDateRange([patient], []);
            expect(result.reports).toHaveLength(1);
            expect(result.reports[0].items).toBeUndefined();
            
            // 测试 itemNames 为非数组
            await expect(LabReport.findByPatientsItemsAndDateRange([patient], 'not an array')).rejects.toThrow(LabReportError);
        });
    });

    describe('findByReportIds', () => {
        test('应该根据检验报告ID列表查找检验报告并包含关联的检验项目', async () => {
            // 创建多个检验报告
            const labReportData1 = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData2 = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Johnson',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData3 = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Brown',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport1 = await LabReport.createWithItems(labReportData1);
            const createdReport2 = await LabReport.createWithItems(labReportData2);
            const createdReport3 = await LabReport.createWithItems(labReportData3);
            
            // 为第一个检验报告创建检验项目
            await LabReportItem.create({
                labReportId: createdReport1.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
            
            await LabReportItem.create({
                labReportId: createdReport1.id,
                itemName: '血糖',
                result: '5.2',
                unit: 'mmol/L',
                referenceValue: '3.9-6.1'
            });
            
            // 为第二个检验报告创建检验项目
            await LabReportItem.create({
                labReportId: createdReport2.id,
                itemName: '尿常规',
                result: '异常',
                unit: 'mg/dL',
                referenceValue: '0-20'
            });
            
            // 第三个检验报告不创建检验项目
            
            // 根据ID列表查找检验报告
            const reportIds = [createdReport1.id, createdReport2.id, createdReport3.id];
            const foundReports = await LabReport.findByReportIds(reportIds);
            
            expect(foundReports).toHaveLength(3);
            expect(foundReports[0]).toBeInstanceOf(LabReport);
            expect(foundReports[1]).toBeInstanceOf(LabReport);
            expect(foundReports[2]).toBeInstanceOf(LabReport);
            
            // 验证返回的检验报告包含正确的ID
            const returnedIds = foundReports.map(report => report.id);
            expect(returnedIds).toContain(createdReport1.id);
            expect(returnedIds).toContain(createdReport2.id);
            expect(returnedIds).toContain(createdReport3.id);
            
            // 验证每个检验报告都包含关联的检验项目
            const report1 = foundReports.find(report => report.id === createdReport1.id);
            const report2 = foundReports.find(report => report.id === createdReport2.id);
            const report3 = foundReports.find(report => report.id === createdReport3.id);
            
            expect(report1.items).toHaveLength(2);
            expect(report2.items).toHaveLength(1);
            expect(report3.items).toHaveLength(0);
            
            // 验证检验项目的内容
            const report1ItemNames = report1.items.map(item => item.itemName);
            const report2ItemNames = report2.items.map(item => item.itemName);
            
            expect(report1ItemNames).toContain('血常规');
            expect(report1ItemNames).toContain('血糖');
            expect(report2ItemNames).toContain('尿常规');
        });
        
        test('应该返回空数组当没有找到任何检验报告', async () => {
            const result = await LabReport.findByReportIds([99999, 99998]);
            expect(result).toHaveLength(0);
        });
        
        test('应该验证检验报告ID列表参数', async () => {
            // 测试 null 参数
            await expect(LabReport.findByReportIds(null)).rejects.toThrow(LabReportError);
            
            // 测试非数组参数
            await expect(LabReport.findByReportIds('not an array')).rejects.toThrow(LabReportError);
            
            // 测试空数组
            await expect(LabReport.findByReportIds([])).rejects.toThrow(LabReportError);
            
            // 测试数组长度超过100
            const largeArray = Array.from({ length: 101 }, (_, i) => i + 1);
            await expect(LabReport.findByReportIds(largeArray)).rejects.toThrow(LabReportError);
        });
        
        test('应该正确处理部分ID不存在的情况', async () => {
            // 创建一个真实的检验报告
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            // 查找包含真实ID和不存在的ID的列表
            const reportIds = [createdReport.id, 99999, 99998];
            const foundReports = await LabReport.findByReportIds(reportIds);
            
            // 应该只返回存在的检验报告
            expect(foundReports).toHaveLength(1);
            expect(foundReports[0].id).toBe(createdReport.id);
        });
        
        test('应该支持查找单个检验报告', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            // 为检验报告创建检验项目
            await LabReportItem.create({
                labReportId: createdReport.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
            
            // 查找单个检验报告
            const foundReports = await LabReport.findByReportIds([createdReport.id]);
            
            expect(foundReports).toHaveLength(1);
            expect(foundReports[0].id).toBe(createdReport.id);
            expect(foundReports[0].items).toHaveLength(1);
            expect(foundReports[0].items[0].itemName).toBe('血常规');
        });
        
        test('应该正确处理重复ID的情况', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            // 查找包含重复ID的列表
            const reportIds = [createdReport.id, createdReport.id, createdReport.id];
            const foundReports = await LabReport.findByReportIds(reportIds);
            
            // 应该只返回一个检验报告（去重）
            expect(foundReports).toHaveLength(1);
            expect(foundReports[0].id).toBe(createdReport.id);
        });
    });
    
    describe('update', () => {
        test('应该成功更新检验报告', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            const updateData = {
                doctor: 'Dr. Johnson',
                hospital: 'Updated Hospital'
            };
            
            const updatedReport = await LabReport.update(createdReport.id, updateData);
            
            expect(updatedReport.doctor).toBe('Dr. Johnson');
            expect(updatedReport.hospital).toBe('Updated Hospital');
            expect(updatedReport.patient).toBe(labReportData.patient); // 未更新的字段保持不变
        });
        
        test('应该验证检验报告存在', async () => {
            const updateData = {
                doctor: 'Dr. Johnson'
            };
            
            await expect(LabReport.update(99999, updateData)).rejects.toThrow(LabReportError);
        });
        
        test('应该允许将doctor更新为空值', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            const updateData = {
                doctor: null
            };
            
            const updatedReport = await LabReport.update(createdReport.id, updateData);
            
            expect(updatedReport.doctor).toBeNull();
            expect(updatedReport.hospital).toBe(labReportData.hospital); // 未更新的字段保持不变
        });
        
        test('应该允许将hospital更新为空值', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            const updateData = {
                hospital: null
            };
            
            const updatedReport = await LabReport.update(createdReport.id, updateData);
            
            expect(updatedReport.hospital).toBeNull();
            expect(updatedReport.doctor).toBe(labReportData.doctor); // 未更新的字段保持不变
        });
        
        test('应该允许将doctor更新为空字符串', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            const updateData = {
                doctor: ''
            };
            
            const updatedReport = await LabReport.update(createdReport.id, updateData);
            
            expect(updatedReport.doctor).toBe('');
            expect(updatedReport.hospital).toBe(labReportData.hospital); // 未更新的字段保持不变
        });
        
        test('应该允许将hospital更新为空字符串', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            const updateData = {
                hospital: ''
            };
            
            const updatedReport = await LabReport.update(createdReport.id, updateData);
            
            expect(updatedReport.hospital).toBe('');
            expect(updatedReport.doctor).toBe(labReportData.doctor); // 未更新的字段保持不变
        });
        
        test('应该验证doctor类型错误', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            const updateData = {
                doctor: 123 // 非字符串类型
            };
            
            await expect(LabReport.update(createdReport.id, updateData)).rejects.toThrow(LabReportError);
        });
        
        test('应该验证hospital类型错误', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            const updateData = {
                hospital: 456 // 非字符串类型
            };
            
            await expect(LabReport.update(createdReport.id, updateData)).rejects.toThrow(LabReportError);
        });
    });
    
    describe('delete', () => {
        test('应该成功删除检验报告', async () => {
            const labReportData = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const createdReport = await LabReport.createWithItems(labReportData);
            
            const result = await LabReport.delete(createdReport.id);
            expect(result).toBe(true);
            
            // 验证已删除
            const foundReport = await LabReport.findById(createdReport.id);
            expect(foundReport).toBeNull();
        });
        
        test('应该返回false当检验报告不存在', async () => {
            const result = await LabReport.delete(99999);
            expect(result).toBe(false);
        });
    });
    
    describe('countByWorkspaceId', () => {
        test('应该正确统计工作空间的检验报告数量', async () => {
            const labReportData1 = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Smith',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            const labReportData2 = {
                patient: generateUniquePatientName(),
                reportTime: new Date(),
                doctor: 'Dr. Johnson',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id
            };
            
            await LabReport.createWithItems(labReportData1);
            await LabReport.createWithItems(labReportData2);
            
            const count = await LabReport.countByWorkspaceId(testWorkspace.id);
            expect(count).toBe(2);
        });
        
        test('应该返回0当工作空间没有检验报告', async () => {
            const count = await LabReport.countByWorkspaceId(testWorkspace.id);
            expect(count).toBe(0);
        });
    });
}); 