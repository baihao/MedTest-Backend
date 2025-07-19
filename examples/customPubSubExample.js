// 自定义发布-订阅系统
class PubSub {
    constructor() {
        this.subscribers = new Map();
        this.middleware = [];
    }
    
    // 订阅事件
    subscribe(event, callback, options = {}) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        
        const subscriber = {
            id: this.generateId(),
            callback,
            options,
            timestamp: Date.now()
        };
        
        this.subscribers.get(event).push(subscriber);
        
        console.log(`订阅者 ${subscriber.id} 订阅了事件: ${event}`);
        
        // 返回取消订阅的函数
        return () => this.unsubscribe(event, subscriber.id);
    }
    
    // 取消订阅
    unsubscribe(event, subscriberId) {
        if (!this.subscribers.has(event)) {
            return false;
        }
        
        const subscribers = this.subscribers.get(event);
        const index = subscribers.findIndex(sub => sub.id === subscriberId);
        
        if (index !== -1) {
            const removed = subscribers.splice(index, 1)[0];
            console.log(`订阅者 ${subscriberId} 取消订阅事件: ${event}`);
            return true;
        }
        
        return false;
    }
    
    // 发布事件
    async publish(event, data) {
        if (!this.subscribers.has(event)) {
            console.log(`事件 ${event} 没有订阅者`);
            return;
        }
        
        const subscribers = this.subscribers.get(event);
        console.log(`发布事件 ${event} 给 ${subscribers.length} 个订阅者`);
        
        // 应用中间件
        let processedData = data;
        for (const middleware of this.middleware) {
            processedData = await middleware(event, processedData);
        }
        
        // 通知所有订阅者
        const promises = subscribers.map(async (subscriber) => {
            try {
                await subscriber.callback(processedData, event, subscriber.id);
            } catch (error) {
                console.error(`订阅者 ${subscriber.id} 处理事件 ${event} 时出错:`, error);
                
                // 如果设置了错误处理选项，调用错误处理函数
                if (subscriber.options.onError) {
                    subscriber.options.onError(error, event, processedData);
                }
            }
        });
        
        await Promise.all(promises);
    }
    
    // 添加中间件
    use(middleware) {
        this.middleware.push(middleware);
        return this;
    }
    
    // 获取事件统计信息
    getStats() {
        const stats = {};
        for (const [event, subscribers] of this.subscribers) {
            stats[event] = {
                subscriberCount: subscribers.length,
                subscribers: subscribers.map(sub => ({
                    id: sub.id,
                    timestamp: sub.timestamp
                }))
            };
        }
        return stats;
    }
    
    // 清空所有订阅
    clear() {
        this.subscribers.clear();
        console.log('所有订阅已清空');
    }
    
    // 生成唯一ID
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
}

// 使用示例
function example() {
    const pubsub = new PubSub();
    
    // 添加中间件
    pubsub.use(async (event, data) => {
        console.log(`中间件处理事件: ${event}`);
        return {
            ...data,
            processedAt: new Date().toISOString()
        };
    });
    
    // 订阅者1
    const unsubscribe1 = pubsub.subscribe('user.login', (data, event, subscriberId) => {
        console.log(`订阅者1 (${subscriberId}) 处理用户登录:`, data);
    }, {
        onError: (error, event, data) => {
            console.error('订阅者1错误处理:', error);
        }
    });
    
    // 订阅者2
    const unsubscribe2 = pubsub.subscribe('user.login', (data, event, subscriberId) => {
        console.log(`订阅者2 (${subscriberId}) 发送欢迎邮件:`, data);
    });
    
    // 订阅者3 - 一次性订阅
    pubsub.subscribe('user.login', (data, event, subscriberId) => {
        console.log(`一次性订阅者 (${subscriberId}) 记录登录日志:`, data);
        // 自动取消订阅
        pubsub.unsubscribe(event, subscriberId);
    });
    
    // 发布事件
    setTimeout(() => {
        pubsub.publish('user.login', {
            userId: 123,
            username: 'john_doe',
            loginTime: new Date().toISOString()
        });
    }, 1000);
    
    // 再次发布事件（一次性订阅者不会收到）
    setTimeout(() => {
        pubsub.publish('user.login', {
            userId: 456,
            username: 'jane_smith',
            loginTime: new Date().toISOString()
        });
    }, 2000);
    
    // 取消订阅
    setTimeout(() => {
        unsubscribe1();
        console.log('订阅者1已取消订阅');
    }, 3000);
    
    // 发布事件（订阅者1不会收到）
    setTimeout(() => {
        pubsub.publish('user.login', {
            userId: 789,
            username: 'bob_wilson',
            loginTime: new Date().toISOString()
        });
    }, 4000);
    
    // 显示统计信息
    setTimeout(() => {
        console.log('\n统计信息:', pubsub.getStats());
    }, 5000);
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
    example();
}

module.exports = PubSub; 