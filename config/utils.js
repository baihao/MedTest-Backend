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

/**
 * 根据 LabReport 实例找到属于其的 userID
 * @param {Object|number} labReport - LabReport实例或LabReport ID
 * @returns {Promise<number|null>} 用户ID，如果找不到则返回null
 */
async function getUserIdFromLabReport(labReport) {
    try {
        let labReportId;
        let workspaceId;

        // 处理参数类型
        if (typeof labReport === 'number') {
            // 如果传入的是ID，先查找LabReport
            labReportId = labReport;
            const { LabReport } = require('../models/labreport');
            const report = await LabReport.findById(labReportId);
            if (!report) {
                return null;
            }
            workspaceId = report.workspaceId;
        } else if (labReport && typeof labReport === 'object') {
            // 如果传入的是LabReport实例
            workspaceId = labReport.workspaceId;
            labReportId = labReport.id;
        } else {
            throw new Error('无效的LabReport参数');
        }

        if (!workspaceId) {
            throw new Error('LabReport缺少workspaceId');
        }

        // 通过workspaceId查找Workspace，获取userId
        const { Workspace } = require('../models/workspace');
        const workspace = await Workspace.findById(workspaceId);
        
        if (!workspace) {
            return null;
        }

        return workspace.userId;
    } catch (error) {
        console.error('获取LabReport用户ID失败:', error);
        return null;
    }
}

module.exports = {
    verifyJWT,
    getUserIdFromLabReport
};

/*
使用示例：

1. 验证JWT token:
const result = verifyJWT(token, secret);
if (result.valid) {
    console.log('用户ID:', result.payload.userId);
} else {
    console.log('验证失败:', result.error);
}

2. 根据LabReport获取用户ID:
// 方式1: 传入LabReport实例
const labReport = await LabReport.findById(123);
const userId = await getUserIdFromLabReport(labReport);

// 方式2: 传入LabReport ID
const userId = await getUserIdFromLabReport(123);

if (userId) {
    console.log('LabReport属于用户:', userId);
    // 可以通过WebSocket向用户发送通知
    wsServer.sendMsgToUser(userId, {
        type: 'labreport_processed',
        labReportId: labReport.id,
        message: '您的检验报告已处理完成'
    });
} else {
    console.log('无法找到LabReport对应的用户');
}
*/ 