const redis = require('redis');

// 创建Redis客户端
const publisher = redis.createClient();
const subscriber = redis.createClient();

// 连接Redis
async function connectRedis() {
    await publisher.connect();
    await subscriber.connect();
    console.log('Redis连接成功');
}

// 订阅者
async function setupSubscriber() {
    // 订阅频道
    await subscriber.subscribe('news', 'sports', (message, channel) => {
        console.log(`订阅者收到来自 ${channel} 频道的消息:`, message);
    });

    // 订阅模式匹配
    await subscriber.pSubscribe('user:*', (message, channel) => {
        console.log(`订阅者收到来自模式 ${channel} 的消息:`, message);
    });
}

// 发布者
async function publishMessages() {
    // 发布到特定频道
    await publisher.publish('news', 'Breaking news: AI breakthrough!');
    await publisher.publish('sports', 'Football match result: 2-1');
    
    // 发布到模式匹配的频道
    await publisher.publish('user:123', 'User 123 logged in');
    await publisher.publish('user:456', 'User 456 made a purchase');
}

// 主函数
async function main() {
    try {
        await connectRedis();
        await setupSubscriber();
        
        // 等待一下确保订阅设置完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('开始发布消息...');
        await publishMessages();
        
        // 等待消息处理
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 清理
        await subscriber.unsubscribe('news', 'sports');
        await subscriber.pUnsubscribe('user:*');
        await publisher.quit();
        await subscriber.quit();
        
    } catch (error) {
        console.error('错误:', error);
    }
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
    main();
}

module.exports = { connectRedis, setupSubscriber, publishMessages }; 