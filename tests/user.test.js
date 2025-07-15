const { User } = require('../models/user');
const bcrypt = require('bcryptjs');
const { generateUniqueUsername } = require('./utils');

describe('User Model', () => {
    let testUser;

    describe('User.create()', () => {
        it('应该成功创建新用户', async () => {
            const username = generateUniqueUsername('newuser');
            const password = 'testpassword';

            testUser = await User.create(username, password);

            expect(testUser).toBeDefined();
            expect(testUser.id).toBeDefined();
            expect(testUser.username).toBe(username);
            expect(testUser.passwordhash).toBeDefined();
            expect(testUser.createdAt).toBeDefined();

            // 验证密码是否正确加密
            const isValid = await bcrypt.compare(password, testUser.passwordhash);
            expect(isValid).toBe(true);
        });

        it('应该为不同用户生成不同的密码哈希', async () => {
            const password = 'samepassword';
            const user1 = await User.create(generateUniqueUsername('user1'), password);
            const user2 = await User.create(generateUniqueUsername('user2'), password);

            expect(user1.passwordhash).not.toBe(user2.passwordhash);
            
            // 但都应该能验证原始密码
            const isValid1 = await bcrypt.compare(password, user1.passwordhash);
            const isValid2 = await bcrypt.compare(password, user2.passwordhash);
            expect(isValid1).toBe(true);
            expect(isValid2).toBe(true);
        });

        it('应该拒绝重复的用户名', async () => {
            const username = generateUniqueUsername('duplicateuser');
            const password = 'password';

            await User.create(username, password);

            // 尝试创建同名用户应该失败
            await expect(User.create(username, password)).rejects.toThrow();
        });
    });

    describe('User.findByUsername()', () => {
        it('应该找到存在的用户', async () => {
            const username = generateUniqueUsername('finduser');
            const password = 'password';

            const createdUser = await User.create(username, password);
            const foundUser = await User.findByUsername(username);

            expect(foundUser).toBeDefined();
            expect(foundUser.id).toBe(createdUser.id);
            expect(foundUser.username).toBe(username);
            expect(foundUser.passwordhash).toBe(createdUser.passwordhash);
        });

        it('应该返回null当用户不存在时', async () => {
            const foundUser = await User.findByUsername('nonexistentuser');
            expect(foundUser).toBeNull();
        });
    });

    describe('User.findById()', () => {
        it('应该通过ID找到用户', async () => {
            const username = generateUniqueUsername('iduser');
            const password = 'password';

            const createdUser = await User.create(username, password);
            const foundUser = await User.findById(createdUser.id);

            expect(foundUser).toBeDefined();
            expect(foundUser.id).toBe(createdUser.id);
            expect(foundUser.username).toBe(username);
        });

        it('应该返回null当ID不存在时', async () => {
            const foundUser = await User.findById(99999);
            expect(foundUser).toBeNull();
        });
    });

    describe('User.verifyPassword()', () => {
        it('应该验证正确的密码', async () => {
            const username = generateUniqueUsername('verifyuser');
            const password = 'correctpassword';

            await User.create(username, password);
            const result = await User.verifyPassword(username, password);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.username).toBe(username);
        });

        it('应该拒绝错误的密码', async () => {
            const username = generateUniqueUsername('verifyuser2');
            const password = 'correctpassword';

            await User.create(username, password);
            const result = await User.verifyPassword(username, 'wrongpassword');

            expect(result).toBeNull();
        });

        it('应该返回null当用户不存在时', async () => {
            const result = await User.verifyPassword('nonexistentuser', 'anypassword');
            expect(result).toBeNull();
        });
    });

    describe('User.delete()', () => {
        it('应该成功删除用户', async () => {
            const username = generateUniqueUsername('deleteuser');
            const password = 'password';

            const createdUser = await User.create(username, password);
            
            // 验证用户存在
            const foundUser = await User.findByUsername(username);
            expect(foundUser).toBeDefined();

            // 删除用户
            const deleteResult = await User.delete(createdUser.id);
            expect(deleteResult).toBe(true);

            // 验证用户已被删除
            const deletedUser = await User.findByUsername(username);
            expect(deletedUser).toBeNull();
        });

        it('应该返回false当删除不存在的用户时', async () => {
            const deleteResult = await User.delete(99999);
            expect(deleteResult).toBe(false);
        });
    });

    describe('User Model Integration', () => {
        it('应该支持完整的用户生命周期', async () => {
            const username = generateUniqueUsername('lifecycleuser');
            const password = 'password';

            // 1. 创建用户
            const user = await User.create(username, password);
            expect(user.username).toBe(username);

            // 2. 查找用户
            const foundUser = await User.findByUsername(username);
            expect(foundUser.id).toBe(user.id);

            // 3. 验证密码
            const verifiedUser = await User.verifyPassword(username, password);
            expect(verifiedUser.id).toBe(user.id);

            // 4. 删除用户
            const deleteResult = await User.delete(user.id);
            expect(deleteResult).toBe(true);

            // 5. 验证删除
            const deletedUser = await User.findByUsername(username);
            expect(deletedUser).toBeNull();
        });
    });
}); 