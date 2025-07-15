const { Workspace } = require('./models/workspace');

async function testDatabase() {
    try {
        console.log('正在初始化数据库...');
        await Workspace.init();
        console.log('数据库初始化成功');
        
        console.log('创建测试数据...');
        const workspace = await Workspace.model.create({
            name: '测试工作空间',
            userId: 'test-user-id'
        });
        console.log('测试数据创建成功:', workspace.toJSON());
        
        const count = await Workspace.model.count();
        console.log(`当前工作空间数量: ${count}`);
        
        await Workspace.sequelize.close();
        console.log('数据库连接已关闭');
    } catch (error) {
        console.error('测试失败:', error);
    }
}

testDatabase();