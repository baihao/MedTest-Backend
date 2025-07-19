const EventEmitter = require('events');

// 创建事件发射器
class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();

// 订阅者1
myEmitter.on('data', (data) => {
    console.log('订阅者1收到数据:', data);
});

// 订阅者2
myEmitter.on('data', (data) => {
    console.log('订阅者2收到数据:', data);
});

// 一次性订阅者
myEmitter.once('data', (data) => {
    console.log('一次性订阅者收到数据:', data);
});

// 错误处理
myEmitter.on('error', (err) => {
    console.error('发生错误:', err);
});

// 发布者发送数据
console.log('发布者发送数据...');
myEmitter.emit('data', { message: 'Hello World', timestamp: Date.now() });

// 再次发送数据（一次性订阅者不会收到）
console.log('\n发布者再次发送数据...');
myEmitter.emit('data', { message: 'Second message', timestamp: Date.now() });

// 获取监听器数量
console.log('\n监听器统计:');
console.log('data事件监听器数量:', myEmitter.listenerCount('data'));
console.log('所有事件名称:', myEmitter.eventNames());

// 移除所有监听器
myEmitter.removeAllListeners('data');
console.log('\n移除所有监听器后，data事件监听器数量:', myEmitter.listenerCount('data')); 