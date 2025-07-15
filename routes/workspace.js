const express = require('express');
const router = express.Router();
const { Workspace } = require('../models/workspace');
const { authenticateJWT, detailedLogger } = require('../config/midware');

// 使用详细日志中间件
router.use(detailedLogger);

// 创建工作空间
router.post('/create', authenticateJWT, async (req, res, next) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({ error: '缺少必要参数: name' });
        }
        
        const workspace = await Workspace.create({
            name: req.body.name,
            userId: Number(req.user.id)
        });
        
        res.status(201).json(workspace);
    } catch (error) {
        // 直接传递给全局错误处理器
        next(error);
    }
});

// 删除工作空间
router.post('/delete/:id', authenticateJWT, async (req, res, next) => {
    try {
        const workspace = await Workspace.findById(req.params.id);
        if (!workspace) {
            return res.status(404).json({ error: '未找到对应workspace' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权删除此workspace' });
        }
        
        const result = await Workspace.delete(req.params.id);
        if (!result) {
            return res.status(404).json({ error: '未找到对应workspace' });
        }
        
        res.json({ id: Number(req.params.id) });
    } catch (error) {
        // 直接传递给全局错误处理器
        next(error);
    }
});

// 获取用户所有工作空间
router.get('/', authenticateJWT, async (req, res, next) => {
    try {
        const workspaces = await Workspace.findByUserId(Number(req.user.id));
        res.json(workspaces);
    } catch (error) {
        // 直接传递给全局错误处理器
        next(error);
    }
});

// 获取单个工作空间
router.get('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const workspace = await Workspace.findById(req.params.id);
        if (!workspace) {
            return res.status(404).json({ error: '未找到对应workspace' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权访问此workspace' });
        }
        
        res.json(workspace);
    } catch (error) {
        // 直接传递给全局错误处理器
        next(error);
    }
});

module.exports = router;