// 测试工具函数

/**
 * 生成唯一的测试用户名
 * @param {string} prefix 用户名前缀
 * @returns {string} 唯一的用户名
 */
function generateUniqueUsername(prefix = 'testuser') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}_${timestamp}_${random}`;
}

/**
 * 生成唯一的测试工作空间名称
 * @param {string} prefix 工作空间名称前缀
 * @returns {string} 唯一的工作空间名称
 */
function generateUniqueWorkspaceName(prefix = '测试工作空间') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}_${timestamp}_${random}`;
}

/**
 * 等待指定的毫秒数
 * @param {number} ms 毫秒数
 * @returns {Promise} Promise对象
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    generateUniqueUsername,
    generateUniqueWorkspaceName,
    sleep
}; 