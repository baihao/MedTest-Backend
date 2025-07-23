const jwt = require('jsonwebtoken');

/**
 * 验证JWT token
 * @param {string} token - 待验证的JWT token
 * @param {string} secret - JWT密钥
 * @returns {object} { valid, payload, error, code }
 *   valid: 是否有效
 *   payload: 解码后的payload（仅valid为true时有值）
 *   error: 错误消息（仅valid为false时有值）
 *   code: 建议的HTTP状态码
 */
function verifyJWT(token, secret) {
    if (!token || typeof token !== 'string' || token.trim() === '') {
        return { valid: false, error: '无效的token格式', code: 401 };
    }
    if (!/^([A-Za-z0-9-_]+\.){2}[A-Za-z0-9-_]+$/.test(token)) {
        return { valid: false, error: '无效的token格式', code: 401 };
    }
    try {
        const payload = jwt.verify(token, secret);
        return { valid: true, payload };
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'token已过期', code: 401 };
        } else if (err.name === 'JsonWebTokenError') {
            return { valid: false, error: '无效token', code: 403 };
        } else {
            return { valid: false, error: 'token验证失败', code: 403 };
        }
    }
}

module.exports = {
    verifyJWT
}; 