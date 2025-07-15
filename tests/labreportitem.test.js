const { ModelManager } = require('../models/modelmgr');
const { LabReportItem, LabReportItemError } = require('../models/labreportitem');
const { LabReport } = require('../models/labreport');
const { Workspace } = require('../models/workspace');
const { User } = require('../models/user');

describe('LabReportItem Model Tests', () => {
    let testUser, testWorkspace, testLabReport;

    beforeAll(async () => {
        await ModelManager.init();
    });

    afterAll(async () => {
        await ModelManager.close();
    });

    beforeEach(async () => {
        // 创建测试用户
        testUser = await User.create('testuser_labitem', 'password123');

        // 创建测试工作空间
        testWorkspace = await Workspace.create({
            name: 'Test Workspace LabItem',
            description: 'Test workspace for lab report items',
            userId: testUser.id
        });

        // 创建测试检验报告
        testLabReport = await LabReport.create({
            patient: '张三',
            reportTime: new Date('2024-01-15'),
            doctor: '李医生',
            hospital: '测试医院',
            workspaceId: testWorkspace.id
        });
    });

    afterEach(async () => {
        // 清理测试数据
        if (testLabReport) {
            await LabReport.delete(testLabReport.id);
        }
        if (testWorkspace) {
            await Workspace.delete(testWorkspace.id);
        }
        if (testUser) {
            await User.delete(testUser.id);
        }
    });

    describe('LabReportItem Creation', () => {
        test('should create a lab report item with valid data', async () => {
            const itemData = {
                labReportId: testLabReport.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            };

            const item = await LabReportItem.create(itemData);

            expect(item).toBeDefined();
            expect(item.id).toBeDefined();
            expect(item.labReportId).toBe(testLabReport.id);
            expect(item.itemName).toBe('血常规');
            expect(item.result).toBe('正常');
            expect(item.unit).toBe('g/L');
            expect(item.referenceValue).toBe('3.5-5.5');
            expect(item.createdAt).toBeDefined();
            expect(item.updatedAt).toBeDefined();

            // 清理
            await LabReportItem.delete(item.id);
        });

        test('should create a lab report item without optional fields', async () => {
            const itemData = {
                labReportId: testLabReport.id,
                itemName: '血糖',
                result: '5.2'
            };

            const item = await LabReportItem.create(itemData);

            expect(item).toBeDefined();
            expect(item.unit).toBeNull();
            expect(item.referenceValue).toBeNull();

            // 清理
            await LabReportItem.delete(item.id);
        });

        test('should throw error when labReportId is invalid', async () => {
            const itemData = {
                labReportId: 99999, // 不存在的ID
                itemName: '血常规',
                result: '正常'
            };

            await expect(LabReportItem.create(itemData)).rejects.toThrow(LabReportItemError);
        });

        test('should throw error when required fields are missing', async () => {
            const itemData = {
                labReportId: testLabReport.id,
                // 缺少 itemName 和 result
            };

            await expect(LabReportItem.create(itemData)).rejects.toThrow(LabReportItemError);
        });

        test('should throw error when itemName is empty', async () => {
            const itemData = {
                labReportId: testLabReport.id,
                itemName: '',
                result: '正常'
            };

            await expect(LabReportItem.create(itemData)).rejects.toThrow(LabReportItemError);
        });

        test('should throw error when result is empty', async () => {
            const itemData = {
                labReportId: testLabReport.id,
                itemName: '血常规',
                result: ''
            };

            await expect(LabReportItem.create(itemData)).rejects.toThrow(LabReportItemError);
        });
    });

    describe('LabReportItem Retrieval', () => {
        let testItem;

        beforeEach(async () => {
            testItem = await LabReportItem.create({
                labReportId: testLabReport.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
        });

        afterEach(async () => {
            if (testItem) {
                await LabReportItem.delete(testItem.id);
            }
        });

        test('should find item by ID', async () => {
            const foundItem = await LabReportItem.findById(testItem.id);

            expect(foundItem).toBeDefined();
            expect(foundItem.id).toBe(testItem.id);
            expect(foundItem.itemName).toBe('血常规');
        });

        test('should return null for non-existent ID', async () => {
            const foundItem = await LabReportItem.findById(99999);
            expect(foundItem).toBeNull();
        });

        test('should find items by lab report ID', async () => {
            // 创建第二个项目
            const item2 = await LabReportItem.create({
                labReportId: testLabReport.id,
                itemName: '血糖',
                result: '5.2',
                unit: 'mmol/L',
                referenceValue: '3.9-6.1'
            });

            const items = await LabReportItem.findByLabReportId(testLabReport.id);

            expect(items).toHaveLength(2);
            expect(items.some(item => item.itemName === '血常规')).toBe(true);
            expect(items.some(item => item.itemName === '血糖')).toBe(true);

            // 清理
            await LabReportItem.delete(item2.id);
        });

        test('should filter items by item names', async () => {
            // 创建第二个项目
            const item2 = await LabReportItem.create({
                labReportId: testLabReport.id,
                itemName: '血糖',
                result: '5.2'
            });

            const items = await LabReportItem.findByLabReportId(testLabReport.id, ['血常规']);

            expect(items).toHaveLength(1);
            expect(items[0].itemName).toBe('血常规');

            // 清理
            await LabReportItem.delete(item2.id);
        });

        test('should find items by item name', async () => {
            const items = await LabReportItem.findByItemName('血常规');

            expect(items).toHaveLength(1);
            expect(items[0].labReportId).toBe(testLabReport.id);
        });
    });

    describe('LabReportItem Update', () => {
        let testItem;

        beforeEach(async () => {
            testItem = await LabReportItem.create({
                labReportId: testLabReport.id,
                itemName: '血常规',
                result: '正常',
                unit: 'g/L',
                referenceValue: '3.5-5.5'
            });
        });

        afterEach(async () => {
            if (testItem) {
                await LabReportItem.delete(testItem.id);
            }
        });

        test('should update item successfully', async () => {
            const updateData = {
                result: '异常',
                unit: 'mg/dL'
            };

            const updatedItem = await LabReportItem.update(testItem.id, updateData);

            expect(updatedItem.result).toBe('异常');
            expect(updatedItem.unit).toBe('mg/dL');
            expect(updatedItem.itemName).toBe('血常规'); // 未更新的字段保持不变
        });

        test('should throw error when updating non-existent item', async () => {
            const updateData = { result: '异常' };

            await expect(LabReportItem.update(99999, updateData)).rejects.toThrow(LabReportItemError);
        });

        test('should throw error when updating with invalid data', async () => {
            const updateData = { result: '' };

            await expect(LabReportItem.update(testItem.id, updateData)).rejects.toThrow(LabReportItemError);
        });
    });

    describe('LabReportItem Deletion', () => {
        let testItem;

        beforeEach(async () => {
            testItem = await LabReportItem.create({
                labReportId: testLabReport.id,
                itemName: '血常规',
                result: '正常'
            });
        });

        test('should delete item successfully', async () => {
            const result = await LabReportItem.delete(testItem.id);
            expect(result).toBe(true);

            const foundItem = await LabReportItem.findById(testItem.id);
            expect(foundItem).toBeNull();
        });

        test('should return false when deleting non-existent item', async () => {
            const result = await LabReportItem.delete(99999);
            expect(result).toBe(false);
        });
    });

    describe('LabReportItem Batch Operations', () => {
        test('should create multiple items in batch', async () => {
            const itemsData = [
                {
                    labReportId: testLabReport.id,
                    itemName: '血常规',
                    result: '正常',
                    unit: 'g/L'
                },
                {
                    labReportId: testLabReport.id,
                    itemName: '血糖',
                    result: '5.2',
                    unit: 'mmol/L'
                },
                {
                    labReportId: testLabReport.id,
                    itemName: '肝功能',
                    result: '正常',
                    unit: 'U/L'
                }
            ];

            const createdItems = await LabReportItem.createBatch(itemsData);

            expect(createdItems).toHaveLength(3);
            expect(createdItems[0].itemName).toBe('血常规');
            expect(createdItems[1].itemName).toBe('血糖');
            expect(createdItems[2].itemName).toBe('肝功能');

            // 清理
            for (const item of createdItems) {
                await LabReportItem.delete(item.id);
            }
        });

        test('should rollback batch creation on error', async () => {
            const itemsData = [
                {
                    labReportId: testLabReport.id,
                    itemName: '血常规',
                    result: '正常'
                },
                {
                    labReportId: testLabReport.id,
                    itemName: '', // 无效数据
                    result: '正常'
                }
            ];

            await expect(LabReportItem.createBatch(itemsData)).rejects.toThrow(LabReportItemError);

            // 验证没有项目被创建
            const items = await LabReportItem.findByLabReportId(testLabReport.id);
            expect(items).toHaveLength(0);
        });
    });

    describe('LabReportItem Statistics', () => {
        test('should count items by lab report ID', async () => {
            // 创建多个项目
            const itemsData = [
                { labReportId: testLabReport.id, itemName: '血常规', result: '正常' },
                { labReportId: testLabReport.id, itemName: '血糖', result: '5.2' },
                { labReportId: testLabReport.id, itemName: '肝功能', result: '正常' }
            ];

            for (const itemData of itemsData) {
                await LabReportItem.create(itemData);
            }

            const count = await LabReportItem.countByLabReportId(testLabReport.id);
            expect(count).toBe(3);

            // 清理
            const items = await LabReportItem.findByLabReportId(testLabReport.id);
            for (const item of items) {
                await LabReportItem.delete(item.id);
            }
        });
    });
}); 