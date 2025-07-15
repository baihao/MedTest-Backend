const { OcrData, OcrDataError } = require('../models/ocrdata');
const { Workspace } = require('../models/workspace');
const { User } = require('../models/user');
const { sequelize } = require('../config/database');

describe('OcrData Model', () => {
    let testUser;
    let testWorkspace;

    // 生成唯一的测试数据
    const generateUniqueOcrData = () => ({
        reportImage: `test_image_${Date.now()}_${Math.random()}.jpg`,
        ocrPrimitive: `OCR结果_${Date.now()}_${Math.random()}`,
        workspaceId: testWorkspace.id
    });

    beforeAll(async () => {
        // 初始化所有模型
        await User.init();
        await Workspace.init();
        await OcrData.init();
        
        // 确保数据库连接
        await sequelize.authenticate();
        
        // 同步数据库
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        // 创建测试用户 - 修复参数格式
        testUser = await User.create(
            `testuser_${Date.now()}`,
            'testpassword123'
        );

        // 创建测试工作空间 - 修复参数格式
        testWorkspace = await Workspace.create({
            name: `test_workspace_${Date.now()}`,
            description: 'Test workspace for OCR data',
            userId: testUser.id
        });
    });

    afterEach(async () => {
        // 清理测试数据
        if (OcrData.model) {
            await OcrData.model.destroy({ where: {}, force: true });
        }
        if (Workspace.model) {
            await Workspace.model.destroy({ where: {}, force: true });
        }
        if (User.model) {
            await User.model.destroy({ where: {}, force: true });
        }
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('数据验证', () => {
        test('应该验证必需的字段', () => {
            const invalidData = {};
            
            expect(() => {
                OcrData.validateOcrData(invalidData);
            }).toThrow(OcrDataError);
        });

        test('应该验证reportImage字段', () => {
            const invalidData = {
                reportImage: '',
                ocrPrimitive: 'test ocr',
                workspaceId: testWorkspace.id
            };
            
            expect(() => {
                OcrData.validateOcrData(invalidData);
            }).toThrow(OcrDataError);
        });

        test('应该验证ocrPrimitive字段', () => {
            const invalidData = {
                reportImage: 'test.jpg',
                ocrPrimitive: '',
                workspaceId: testWorkspace.id
            };
            
            expect(() => {
                OcrData.validateOcrData(invalidData);
            }).toThrow(OcrDataError);
        });

        test('应该验证workspaceId字段', () => {
            const invalidData = {
                reportImage: 'test.jpg',
                ocrPrimitive: 'test ocr',
                workspaceId: 'invalid'
            };
            
            expect(() => {
                OcrData.validateOcrData(invalidData);
            }).toThrow(OcrDataError);
        });
    });

    describe('create方法', () => {
        test('应该成功创建OCR数据', async () => {
            const ocrData = generateUniqueOcrData();
            
            const createdOcrData = await OcrData.create(ocrData);
            
            expect(createdOcrData).toBeInstanceOf(OcrData);
            expect(createdOcrData.id).toBeDefined();
            expect(createdOcrData.reportImage).toBe(ocrData.reportImage);
            expect(createdOcrData.ocrPrimitive).toBe(ocrData.ocrPrimitive);
            expect(createdOcrData.workspaceId).toBe(ocrData.workspaceId);
            expect(createdOcrData.createdAt).toBeDefined();
            expect(createdOcrData.updatedAt).toBeDefined();
        });

        test('应该验证工作空间存在', async () => {
            const ocrData = {
                reportImage: 'test.jpg',
                ocrPrimitive: 'test ocr',
                workspaceId: 99999 // 不存在的workspaceId
            };
            
            await expect(OcrData.create(ocrData)).rejects.toThrow(OcrDataError);
        });

        test('应该自动去除字符串字段的空白字符', async () => {
            const ocrData = {
                reportImage: '  test.jpg  ',
                ocrPrimitive: '  test ocr  ',
                workspaceId: testWorkspace.id
            };
            
            const createdOcrData = await OcrData.create(ocrData);
            
            expect(createdOcrData.reportImage).toBe('test.jpg');
            expect(createdOcrData.ocrPrimitive).toBe('test ocr');
        });
    });

    describe('createBatch方法', () => {
        test('应该成功批量创建OCR数据', async () => {
            const ocrDataArray = [
                generateUniqueOcrData(),
                generateUniqueOcrData(),
                generateUniqueOcrData()
            ];
            
            const createdOcrDataArray = await OcrData.createBatch(ocrDataArray);
            
            expect(Array.isArray(createdOcrDataArray)).toBe(true);
            expect(createdOcrDataArray).toHaveLength(3);
            
            createdOcrDataArray.forEach((ocrData, index) => {
                expect(ocrData).toBeInstanceOf(OcrData);
                expect(ocrData.id).toBeDefined();
                expect(ocrData.reportImage).toBe(ocrDataArray[index].reportImage);
                expect(ocrData.ocrPrimitive).toBe(ocrDataArray[index].ocrPrimitive);
                expect(ocrData.workspaceId).toBe(ocrDataArray[index].workspaceId);
            });
        });

        test('应该验证输入数组', async () => {
            await expect(OcrData.createBatch(null)).rejects.toThrow(OcrDataError);
            await expect(OcrData.createBatch([])).rejects.toThrow(OcrDataError);
            await expect(OcrData.createBatch('not an array')).rejects.toThrow(OcrDataError);
        });

        test('应该在批量创建失败时回滚事务', async () => {
            const ocrDataArray = [
                generateUniqueOcrData(),
                {
                    reportImage: 'test.jpg',
                    ocrPrimitive: 'test ocr',
                    workspaceId: 99999 // 不存在的workspaceId，会导致失败
                }
            ];
            
            await expect(OcrData.createBatch(ocrDataArray)).rejects.toThrow(OcrDataError);
            
            // 验证没有数据被创建
            const allOcrData = await OcrData.model.findAll();
            expect(allOcrData).toHaveLength(0);
        });
    });

    describe('getBatch方法', () => {
        beforeEach(async () => {
            // 创建一些测试数据
            const ocrDataArray = [];
            for (let i = 0; i < 15; i++) {
                ocrDataArray.push(generateUniqueOcrData());
            }
            await OcrData.createBatch(ocrDataArray);
        });

        test('应该使用默认批次大小获取数据', async () => {
            const batch = await OcrData.getBatch();
            
            expect(Array.isArray(batch)).toBe(true);
            expect(batch.length).toBeLessThanOrEqual(100);
            expect(batch.length).toBeGreaterThan(0);
            
            batch.forEach(ocrData => {
                expect(ocrData).toBeInstanceOf(OcrData);
            });
        });

        test('应该使用指定的批次大小获取数据', async () => {
            const batch = await OcrData.getBatch(5);
            
            expect(Array.isArray(batch)).toBe(true);
            expect(batch).toHaveLength(5);
        });

        test('应该验证批次大小参数', async () => {
            await expect(OcrData.getBatch(0)).rejects.toThrow(OcrDataError);
            await expect(OcrData.getBatch(-1)).rejects.toThrow(OcrDataError);
            await expect(OcrData.getBatch('invalid')).rejects.toThrow(OcrDataError);
        });

        test('应该限制最大批次大小为1000', async () => {
            const batch = await OcrData.getBatch(2000);
            
            expect(batch.length).toBeLessThanOrEqual(1000);
        });

        test('应该按创建时间升序排列', async () => {
            const batch = await OcrData.getBatch(10);
            
            for (let i = 1; i < batch.length; i++) {
                expect(new Date(batch[i].createdAt).getTime())
                    .toBeGreaterThanOrEqual(new Date(batch[i-1].createdAt).getTime());
            }
        });
    });

    describe('deleteBatch方法', () => {
        let testOcrDataArray;

        beforeEach(async () => {
            // 创建测试数据
            const ocrDataArray = [
                generateUniqueOcrData(),
                generateUniqueOcrData(),
                generateUniqueOcrData()
            ];
            testOcrDataArray = await OcrData.createBatch(ocrDataArray);
        });

        test('应该成功批量删除OCR数据', async () => {
            const idsToDelete = testOcrDataArray.map(ocrData => ocrData.id);
            
            const result = await OcrData.deleteBatch(idsToDelete);
            
            expect(result.deletedCount).toBe(3);
            expect(result.deletedIds).toEqual(idsToDelete);
            
            // 验证数据已被删除
            const remainingData = await OcrData.model.findAll();
            expect(remainingData).toHaveLength(0);
        });

        test('应该验证输入数组', async () => {
            await expect(OcrData.deleteBatch(null)).rejects.toThrow(OcrDataError);
            await expect(OcrData.deleteBatch([])).rejects.toThrow(OcrDataError);
            await expect(OcrData.deleteBatch('not an array')).rejects.toThrow(OcrDataError);
        });

        test('应该验证ID格式', async () => {
            await expect(OcrData.deleteBatch([1, 'invalid', 3])).rejects.toThrow(OcrDataError);
            await expect(OcrData.deleteBatch([1, -1, 3])).rejects.toThrow(OcrDataError);
        });

        test('应该验证所有记录都存在', async () => {
            const idsToDelete = [testOcrDataArray[0].id, 99999]; // 包含不存在的ID
            
            await expect(OcrData.deleteBatch(idsToDelete)).rejects.toThrow(OcrDataError);
            
            // 验证没有数据被删除
            const remainingData = await OcrData.model.findAll();
            expect(remainingData).toHaveLength(3);
        });

        test('应该在批量删除失败时回滚事务', async () => {
            const idsToDelete = [testOcrDataArray[0].id, 99999]; // 包含不存在的ID
            
            await expect(OcrData.deleteBatch(idsToDelete)).rejects.toThrow(OcrDataError);
            
            // 验证没有数据被删除
            const remainingData = await OcrData.model.findAll();
            expect(remainingData).toHaveLength(3);
        });
    });

    describe('findById方法', () => {
        let testOcrData;

        beforeEach(async () => {
            testOcrData = await OcrData.create(generateUniqueOcrData());
        });

        test('应该根据ID找到OCR数据', async () => {
            const foundOcrData = await OcrData.findById(testOcrData.id);
            
            expect(foundOcrData).toBeInstanceOf(OcrData);
            expect(foundOcrData.id).toBe(testOcrData.id);
            expect(foundOcrData.reportImage).toBe(testOcrData.reportImage);
            expect(foundOcrData.ocrPrimitive).toBe(testOcrData.ocrPrimitive);
            expect(foundOcrData.workspaceId).toBe(testOcrData.workspaceId);
        });

        test('应该返回null当ID不存在时', async () => {
            const foundOcrData = await OcrData.findById(99999);
            
            expect(foundOcrData).toBeNull();
        });

        test('应该验证ID格式', async () => {
            await expect(OcrData.findById('invalid')).rejects.toThrow(OcrDataError);
            await expect(OcrData.findById(null)).rejects.toThrow(OcrDataError);
        });
    });

    describe('findByWorkspaceId方法', () => {
        let testWorkspace2;
        let ocrDataArray;

        beforeEach(async () => {
            // 创建第二个工作空间
            testWorkspace2 = await Workspace.create({
                name: `test_workspace2_${Date.now()}`,
                description: 'Test workspace 2 for OCR data',
                userId: testUser.id
            });

            // 创建测试数据
            const dataArray = [
                generateUniqueOcrData(),
                generateUniqueOcrData(),
                generateUniqueOcrData()
            ];
            
            // 为第二个工作空间创建数据
            const dataArray2 = [
                { ...generateUniqueOcrData(), workspaceId: testWorkspace2.id },
                { ...generateUniqueOcrData(), workspaceId: testWorkspace2.id }
            ];

            ocrDataArray = await OcrData.createBatch([...dataArray, ...dataArray2]);
        });

        test('应该根据工作空间ID找到OCR数据', async () => {
            const foundOcrData = await OcrData.findByWorkspaceId(testWorkspace.id);
            
            expect(Array.isArray(foundOcrData)).toBe(true);
            expect(foundOcrData).toHaveLength(3);
            
            foundOcrData.forEach(ocrData => {
                expect(ocrData).toBeInstanceOf(OcrData);
                expect(ocrData.workspaceId).toBe(testWorkspace.id);
            });
        });

        test('应该支持分页参数', async () => {
            const foundOcrData = await OcrData.findByWorkspaceId(testWorkspace.id, 2, 0);
            
            expect(foundOcrData).toHaveLength(2);
        });

        test('应该按创建时间降序排列', async () => {
            const foundOcrData = await OcrData.findByWorkspaceId(testWorkspace.id);
            
            for (let i = 1; i < foundOcrData.length; i++) {
                expect(new Date(foundOcrData[i].createdAt).getTime())
                    .toBeLessThanOrEqual(new Date(foundOcrData[i-1].createdAt).getTime());
            }
        });

        test('应该验证工作空间ID格式', async () => {
            await expect(OcrData.findByWorkspaceId('invalid')).rejects.toThrow(OcrDataError);
            await expect(OcrData.findByWorkspaceId(null)).rejects.toThrow(OcrDataError);
        });

        test('应该限制最大查询数量为1000', async () => {
            const foundOcrData = await OcrData.findByWorkspaceId(testWorkspace.id, 2000);
            
            expect(foundOcrData.length).toBeLessThanOrEqual(1000);
        });
    });

    describe('错误处理', () => {
        test('应该正确处理数据库错误', async () => {
            // 模拟数据库错误
            const originalCreate = OcrData.model.create;
            OcrData.model.create = jest.fn().mockRejectedValue(new Error('Database error'));
            
            await expect(OcrData.create(generateUniqueOcrData())).rejects.toThrow(OcrDataError);
            
            // 恢复原始方法
            OcrData.model.create = originalCreate;
        });

        test('应该保持错误类型', async () => {
            try {
                await OcrData.create({});
            } catch (error) {
                expect(error).toBeInstanceOf(OcrDataError);
                expect(error.name).toBe('OcrDataError');
            }
        });
    });
}); 