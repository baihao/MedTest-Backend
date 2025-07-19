const amqp = require('amqplib');

// RabbitMQ连接配置
const RABBITMQ_URL = 'amqp://localhost';
const EXCHANGE_NAME = 'logs';
const EXCHANGE_TYPE = 'fanout'; // fanout, direct, topic

// 发布者
async function publisher() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        
        // 声明交换机
        await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
            durable: false
        });
        
        console.log('发布者已连接');
        
        // 发布消息
        const message = {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Hello from publisher!'
        };
        
        channel.publish(EXCHANGE_NAME, '', Buffer.from(JSON.stringify(message)));
        console.log('消息已发布:', message);
        
        // 关闭连接
        setTimeout(() => {
            connection.close();
        }, 500);
        
    } catch (error) {
        console.error('发布者错误:', error);
    }
}

// 订阅者
async function subscriber(subscriberName) {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        
        // 声明交换机
        await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
            durable: false
        });
        
        // 声明队列（让RabbitMQ自动生成队列名）
        const queueResult = await channel.assertQueue('', {
            exclusive: true
        });
        
        const queueName = queueResult.queue;
        
        // 绑定队列到交换机
        await channel.bindQueue(queueName, EXCHANGE_NAME, '');
        
        console.log(`${subscriberName} 已连接，队列名: ${queueName}`);
        
        // 消费消息
        channel.consume(queueName, (msg) => {
            if (msg) {
                const content = JSON.parse(msg.content.toString());
                console.log(`${subscriberName} 收到消息:`, content);
                
                // 确认消息
                channel.ack(msg);
            }
        });
        
        // 保持连接
        setTimeout(() => {
            connection.close();
        }, 2000);
        
    } catch (error) {
        console.error(`${subscriberName} 错误:`, error);
    }
}

// 主函数
async function main() {
    console.log('启动RabbitMQ发布-订阅示例...');
    
    // 启动订阅者
    subscriber('订阅者1');
    subscriber('订阅者2');
    
    // 等待订阅者启动
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 启动发布者
    publisher();
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
    main();
}

module.exports = { publisher, subscriber }; 