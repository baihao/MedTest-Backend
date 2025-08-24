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

// 检查token是否有效的API
router.get('/checkToken', async (req, res, next) => {
    try {
        const { username, token } = req.query;
        
        if (!username || !token) {
            return res.status(400).json({ 
                error: 'Username and token are required' 
            });
        }
        
        try {
            // 验证JWT token
            const decoded = jwt.verify(token, config.SECRET_KEY);
            
            // 检查token中的username是否匹配
            if (decoded.username !== username) {
                return res.status(401).json({ 
                    error: 'Token username mismatch',
                    valid: false 
                });
            }
            
            // 检查用户是否仍然存在于数据库中
            const user = await User.findByUsername(username);
            if (!user) {
                return res.status(401).json({ 
                    error: 'User not found',
                    valid: false 
                });
            }
            
            // 检查token是否过期
            const currentTime = Math.floor(Date.now() / 1000);
            if (decoded.exp && decoded.exp < currentTime) {
                return res.status(401).json({ 
                    error: 'Token expired',
                    valid: false 
                });
            }
            
            res.json({ 
                valid: true, 
                username: decoded.username,
                expiresAt: decoded.exp 
            });
            
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    error: 'Token expired',
                    valid: false 
                });
            } else if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    error: 'Invalid token',
                    valid: false 
                });
            } else {
                return res.status(401).json({ 
                    error: 'Token verification failed',
                    valid: false 
                });
            }
        }
        
    } catch (err) {
        // 只处理系统错误，交给 errorHandler
        next(err);
    }
});

module.exports = router;