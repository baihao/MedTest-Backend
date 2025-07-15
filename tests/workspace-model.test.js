const { Workspace } = require('../models/workspace');
const { User } = require('../models/user');
const { generateUniqueUsername, generateUniqueWorkspaceName } = require('./utils');

describe('Workspace Model', () => {
    let testUser;
    let testWorkspace;

    beforeEach(async () => {
        // 创建测试用户
        testUser = await User.create(generateUniqueUsername('testuser'), 'password');
    });

    describe('Workspace.create()', () => {
        it('应该成功创建工作空间', async () => {
            const workspaceData = {
                name: generateUniqueWorkspaceName('测试工作空间'),
                userId: testUser.id
            };

            testWorkspace = await Workspace.create(workspaceData);

            expect(testWorkspace).toBeDefined();
            expect(testWorkspace.id).toBeDefined();
            expect(testWorkspace.name).toBe(workspaceData.name);
            expect(testWorkspace.userId).toBe(testUser.id);
            expect(testWorkspace.createdAt).toBeDefined();
        });

        it('应该为不同用户创建独立的工作空间', async () => {
            const user2 = await User.create(generateUniqueUsername('user2'), 'password');

            const workspace1 = await Workspace.create({
                name: generateUniqueWorkspaceName('用户1的工作空间'),
                userId: testUser.id
            });

            const workspace2 = await Workspace.create({
                name: generateUniqueWorkspaceName('用户2的工作空间'),
                userId: user2.id
            });

            expect(workspace1.id).not.toBe(workspace2.id);
            expect(workspace1.userId).toBe(testUser.id);
            expect(workspace2.userId).toBe(user2.id);
        });

        it('应该拒绝创建没有名称的工作空间', async () => {
            const workspaceData = {
                name: null,
                userId: testUser.id
            };

            await expect(Workspace.create(workspaceData)).rejects.toThrow();
        });

        it('应该拒绝创建没有用户ID的工作空间', async () => {
            const workspaceData = {
                name: generateUniqueWorkspaceName('测试工作空间'),
                userId: null
            };

            await expect(Workspace.create(workspaceData)).rejects.toThrow();
        });
    });

    describe('Workspace.findById()', () => {
        it('应该通过ID找到工作空间', async () => {
            const workspaceData = {
                name: generateUniqueWorkspaceName('查找测试工作空间'),
                userId: testUser.id
            };

            const createdWorkspace = await Workspace.create(workspaceData);
            const foundWorkspace = await Workspace.findById(createdWorkspace.id);

            expect(foundWorkspace).toBeDefined();
            expect(foundWorkspace.id).toBe(createdWorkspace.id);
            expect(foundWorkspace.name).toBe(workspaceData.name);
            expect(foundWorkspace.userId).toBe(testUser.id);
        });

        it('应该返回null当工作空间不存在时', async () => {
            const foundWorkspace = await Workspace.findById(99999);
            expect(foundWorkspace).toBeNull();
        });
    });

    describe('Workspace.findByUserId()', () => {
        it('应该找到用户的所有工作空间', async () => {
            const user2 = await User.create(generateUniqueUsername('user2'), 'password');

            // 为用户1创建多个工作空间
            const workspace1 = await Workspace.create({
                name: generateUniqueWorkspaceName('工作空间1'),
                userId: testUser.id
            });

            const workspace2 = await Workspace.create({
                name: generateUniqueWorkspaceName('工作空间2'),
                userId: testUser.id
            });

            // 为用户2创建一个工作空间
            await Workspace.create({
                name: generateUniqueWorkspaceName('用户2的工作空间'),
                userId: user2.id
            });

            // 查找用户1的所有工作空间
            const userWorkspaces = await Workspace.findByUserId(testUser.id);

            expect(userWorkspaces).toHaveLength(2);
            expect(userWorkspaces.map(w => w.id)).toContain(workspace1.id);
            expect(userWorkspaces.map(w => w.id)).toContain(workspace2.id);
            expect(userWorkspaces.every(w => w.userId === testUser.id)).toBe(true);
        });

        it('应该返回空数组当用户没有工作空间时', async () => {
            const userWorkspaces = await Workspace.findByUserId(testUser.id);
            expect(userWorkspaces).toHaveLength(0);
        });

        it('应该返回空数组当用户不存在时', async () => {
            const userWorkspaces = await Workspace.findByUserId(99999);
            expect(userWorkspaces).toHaveLength(0);
        });
    });

    describe('Workspace.delete()', () => {
        it('应该成功删除工作空间', async () => {
            const workspaceData = {
                name: generateUniqueWorkspaceName('删除测试工作空间'),
                userId: testUser.id
            };

            const createdWorkspace = await Workspace.create(workspaceData);
            
            // 验证工作空间存在
            const foundWorkspace = await Workspace.findById(createdWorkspace.id);
            expect(foundWorkspace).toBeDefined();

            // 删除工作空间
            const deleteResult = await Workspace.delete(createdWorkspace.id);
            expect(deleteResult).toBe(true);

            // 验证工作空间已被删除
            const deletedWorkspace = await Workspace.findById(createdWorkspace.id);
            expect(deletedWorkspace).toBeNull();
        });

        it('应该返回false当删除不存在的工作空间时', async () => {
            const deleteResult = await Workspace.delete(99999);
            expect(deleteResult).toBe(false);
        });

        it('删除工作空间不应该影响其他工作空间', async () => {
            const workspace1 = await Workspace.create({
                name: generateUniqueWorkspaceName('工作空间1'),
                userId: testUser.id
            });

            const workspace2 = await Workspace.create({
                name: generateUniqueWorkspaceName('工作空间2'),
                userId: testUser.id
            });

            // 删除工作空间1
            await Workspace.delete(workspace1.id);

            // 验证工作空间2仍然存在
            const remainingWorkspace = await Workspace.findById(workspace2.id);
            expect(remainingWorkspace).toBeDefined();
            expect(remainingWorkspace.id).toBe(workspace2.id);
        });
    });

    describe('Workspace Model Integration', () => {
        it('应该支持完整的工作空间生命周期', async () => {
            // 1. 创建工作空间
            const workspaceName = generateUniqueWorkspaceName('生命周期测试工作空间');
            const workspace = await Workspace.create({
                name: workspaceName,
                userId: testUser.id
            });
            expect(workspace.name).toBe(workspaceName);

            // 2. 查找工作空间
            const foundWorkspace = await Workspace.findById(workspace.id);
            expect(foundWorkspace.id).toBe(workspace.id);

            // 3. 查找用户的所有工作空间
            const userWorkspaces = await Workspace.findByUserId(testUser.id);
            expect(userWorkspaces).toHaveLength(1);
            expect(userWorkspaces[0].id).toBe(workspace.id);

            // 4. 删除工作空间
            const deleteResult = await Workspace.delete(workspace.id);
            expect(deleteResult).toBe(true);

            // 5. 验证删除
            const deletedWorkspace = await Workspace.findById(workspace.id);
            expect(deletedWorkspace).toBeNull();

            // 6. 验证用户工作空间列表为空
            const emptyWorkspaces = await Workspace.findByUserId(testUser.id);
            expect(emptyWorkspaces).toHaveLength(0);
        });

        it('应该再删除用户的情况下删除掉用户的工作空间', async () => {
            const workspace = await Workspace.create({
                name: generateUniqueWorkspaceName('删除用户测试工作空间'),
                userId: testUser.id
            });
            
            await User.delete(testUser.id);

            const deletedWorkspace = await Workspace.findByUserId(testUser.id);
            expect(deletedWorkspace).toHaveLength(0); 
        });

        it('应该正确处理多用户多工作空间的场景', async () => {
            const user2 = await User.create(generateUniqueUsername('user2'), 'password');
            const user3 = await User.create(generateUniqueUsername('user3'), 'password');

            // 为用户1创建2个工作空间
            const ws1_1 = await Workspace.create({ name: generateUniqueWorkspaceName('用户1工作空间1'), userId: testUser.id });
            const ws1_2 = await Workspace.create({ name: generateUniqueWorkspaceName('用户1工作空间2'), userId: testUser.id });

            // 为用户2创建1个工作空间
            const ws2_1 = await Workspace.create({ name: generateUniqueWorkspaceName('用户2工作空间1'), userId: user2.id });

            // 为用户3创建3个工作空间
            const ws3_1 = await Workspace.create({ name: generateUniqueWorkspaceName('用户3工作空间1'), userId: user3.id });
            const ws3_2 = await Workspace.create({ name: generateUniqueWorkspaceName('用户3工作空间2'), userId: user3.id });
            const ws3_3 = await Workspace.create({ name: generateUniqueWorkspaceName('用户3工作空间3'), userId: user3.id });

            // 验证各用户的工作空间数量
            const user1Workspaces = await Workspace.findByUserId(testUser.id);
            const user2Workspaces = await Workspace.findByUserId(user2.id);
            const user3Workspaces = await Workspace.findByUserId(user3.id);

            expect(user1Workspaces).toHaveLength(2);
            expect(user2Workspaces).toHaveLength(1);
            expect(user3Workspaces).toHaveLength(3);

            // 删除用户2的工作空间
            await Workspace.delete(ws2_1.id);

            // 验证删除后各用户的工作空间数量
            const user1WorkspacesAfter = await Workspace.findByUserId(testUser.id);
            const user2WorkspacesAfter = await Workspace.findByUserId(user2.id);
            const user3WorkspacesAfter = await Workspace.findByUserId(user3.id);

            expect(user1WorkspacesAfter).toHaveLength(2);
            expect(user2WorkspacesAfter).toHaveLength(0);
            expect(user3WorkspacesAfter).toHaveLength(3);
        });
    });
}); 