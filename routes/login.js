const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/user');
const config = require('../config/config');
const { detailedLogger } = require('../config/midware');
const router = express.Router();

// 使用详细日志中间件
router.use(detailedLogger);

router.post('/', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required' 
            });
        }
        
        // 检查用户是否存在
        const existingUser = await User.findByUsername(username);
        let user;
        
        if (existingUser) {
            // 验证密码
            const verifiedUser = await User.verifyPassword(username, password);
            if (!verifiedUser) {
                return res.status(401).json({ 
                    error: 'Invalid credentials' 
                });
            }
            user = verifiedUser;
        } else {
            // 创建新用户
            const newUser = await User.create(username, password);
            user = { id: newUser.id, username: newUser.username };
        }
        
        // 生成JWT token
        const token = jwt.sign({ id: user.id, username: user.username }, config.SECRET_KEY, { expiresIn: '1h' });
        const responseBody = { username: user.username, token };
        res.json(responseBody);
        
    } catch (err) {
        // 只处理系统错误，交给 errorHandler
        next(err);
    }
});

module.exports = router;