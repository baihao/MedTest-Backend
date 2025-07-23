const jwt = require('jsonwebtoken');
const { verifyJWT, getUserIdFromLabReport } = require('../config/utils');
const { User } = require('../models/user');
const { Workspace } = require('../models/workspace');
const { LabReport } = require('../models/labreport');
const config = require('../config/config');

describe('Utils Tests', () => {
    const jwtSecret = config.SECRET_KEY;

    describe('verifyJWT', () => {
        test('验证有效的JWT token', () => {
            const payload = { userId: 123, username: 'testuser' };
            const token = jwt.sign(payload, jwtSecret);
            
            const result = verifyJWT(token, jwtSecret);
            
            expect(result.valid).toBe(true);
            expect(result.payload.userId).toBe(payload.userId);
            expect(result.payload.username).toBe(payload.username);
            expect(result.payload.iat).toBeDefined(); // JWT会自动添加iat字段
            expect(result.error).toBeUndefined();
        });

        test('验证无效的token格式', () => {
            const result = verifyJWT('invalid-token', jwtSecret);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('无效的token格式');
            expect(result.code).toBe(401);
        });

        test('验证空的token', () => {
            const result = verifyJWT('', jwtSecret);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('无效的token格式');
            expect(result.code).toBe(401);
        });

        test('验证null token', () => {
            const result = verifyJWT(null, jwtSecret);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('无效的token格式');
            expect(result.code).toBe(401);
        });

        test('验证过期的token', () => {
            const payload = { userId: 123 };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '1ms' });
            
            // 等待token过期
            setTimeout(() => {
                const result = verifyJWT(token, jwtSecret);
                
                expect(result.valid).toBe(false);
                expect(result.error).toBe('token已过期');
                expect(result.code).toBe(401);
            }, 10);
        });

        test('验证无效签名的token', () => {
            const payload = { userId: 123 };
            const token = jwt.sign(payload, 'wrong-secret');
            
            const result = verifyJWT(token, jwtSecret);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('无效token');
            expect(result.code).toBe(403);
        });
    });

    describe('getUserIdFromLabReport', () => {
        let testUser, testWorkspace, testLabReport;

        beforeEach(async () => {
            // 创建测试用户
            testUser = await User.create('test_user_utils', 'testpassword123');
            
            // 创建测试工作空间
            testWorkspace = await Workspace.create({
                name: 'Test Workspace',
                userId: testUser.id
            });
            
            // 创建测试检验报告
            testLabReport = await LabReport.createWithItems({
                patient: 'Test Patient',
                reportTime: new Date(),
                doctor: 'Test Doctor',
                hospital: 'Test Hospital',
                workspaceId: testWorkspace.id,
                items: []
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

        test('通过LabReport实例获取用户ID', async () => {
            const userId = await getUserIdFromLabReport(testLabReport);
            
            expect(userId).toBe(testUser.id);
        });

        test('通过LabReport ID获取用户ID', async () => {
            const userId = await getUserIdFromLabReport(testLabReport.id);
            
            expect(userId).toBe(testUser.id);
        });

        test('传入不存在的LabReport ID', async () => {
            const userId = await getUserIdFromLabReport(999999);
            
            expect(userId).toBeNull();
        });

        test('传入无效参数', async () => {
            const userId = await getUserIdFromLabReport(null);
            
            expect(userId).toBeNull();
        });

        test('传入无效对象', async () => {
            const userId = await getUserIdFromLabReport({});
            
            expect(userId).toBeNull();
        });

        test('传入缺少workspaceId的LabReport', async () => {
            const invalidLabReport = { id: 1, patient: 'Test' };
            const userId = await getUserIdFromLabReport(invalidLabReport);
            
            expect(userId).toBeNull();
        });
    });
}); 