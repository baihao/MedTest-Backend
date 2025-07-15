const express = require('express');
const router = express.Router();
const { LabReport, LabReportError } = require('../models/labreport');
const { LabReportItem } = require('../models/labreportitem');
const { Workspace } = require('../models/workspace');
const { authenticateJWT, detailedLogger } = require('../config/midware');

// 使用详细日志中间件
router.use(detailedLogger);

// 1. 获得当前workspace下的labreport数量
router.get('/count/:workspaceId', authenticateJWT, async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        
        // 验证工作空间权限
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: '工作空间不存在' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权访问此工作空间' });
        }
        
        const count = await LabReport.countByWorkspaceId(workspaceId);
        res.json({ count });
    } catch (error) {
        next(error);
    }
});

// 2. 直接获得当前workspace下labreport实例列表，不包括labreportitem
router.get('/workspace/:workspaceId', authenticateJWT, async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        
        // 验证工作空间权限
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: '工作空间不存在' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权访问此工作空间' });
        }
        
        const labReports = await LabReport.findByWorkspaceId(workspaceId);
        res.json(labReports);
    } catch (error) {
        next(error);
    }
});

// 3. 分页获得当前workspace下的labreport实例列表，不包括labreportitem
router.get('/workspace/:workspaceId/paginated', authenticateJWT, async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const { page = 1, pageSize = 20 } = req.query;
        
        // 验证工作空间权限
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: '工作空间不存在' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权访问此工作空间' });
        }
        
        const result = await LabReport.findByWorkspaceIdWithPagination(
            workspaceId, 
            parseInt(page), 
            parseInt(pageSize)
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// 4. 使用labreportID获得相应的labreport实例，包括相关的labreportitem
router.get('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const labReport = await LabReport.findByIdWithItems(id);
        if (!labReport) {
            return res.status(404).json({ error: '检验报告不存在' });
        }
        
        // 验证工作空间权限
        const workspace = await Workspace.findById(labReport.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: '工作空间不存在' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权访问此检验报告' });
        }
        
        res.json(labReport);
    } catch (error) {
        next(error);
    }
});

// 5. 使用labreportID来update labreport实例，不包含labreportitem
router.put('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // 检查检验报告是否存在并验证权限
        const existingReport = await LabReport.findById(id);
        if (!existingReport) {
            return res.status(404).json({ error: '检验报告不存在' });
        }
        
        // 验证工作空间权限
        const workspace = await Workspace.findById(existingReport.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: '工作空间不存在' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权修改此检验报告' });
        }
        
        const updatedReport = await LabReport.update(id, updateData);
        res.json(updatedReport);
    } catch (error) {
        next(error);
    }
});

// 6. 根据labreportID删除某个labreport实例以及相关联的labreportitem
router.delete('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // 检查检验报告是否存在并验证权限
        const existingReport = await LabReport.findById(id);
        if (!existingReport) {
            return res.status(404).json({ error: '检验报告不存在' });
        }
        
        // 验证工作空间权限
        const workspace = await Workspace.findById(existingReport.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: '工作空间不存在' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权删除此检验报告' });
        }
        
        // 删除检验报告（数据库会自动级联删除相关的检验项目）
        const result = await LabReport.delete(id);
        if (!result) {
            return res.status(404).json({ error: '检验报告删除失败' });
        }
        
        res.json({ id: parseInt(id), message: '检验报告删除成功' });
    } catch (error) {
        next(error);
    }
});

// 7. 根据患者姓名，labreportItem过滤列表，时间范围来获得当前workspace下的labreport以及相关的labreportitem，采用分页方式获得
router.post('/search', authenticateJWT, async (req, res, next) => {
    try {
        const { 
            workspaceId, 
            patients, 
            itemNames, 
            startDate, 
            endDate, 
            page = 1, 
            pageSize = 20 
        } = req.body;
        
        // 验证必需参数
        if (!workspaceId) {
            return res.status(400).json({ error: '工作空间ID是必需的' });
        }
        
        if (!patients || !Array.isArray(patients) || patients.length === 0) {
            return res.status(400).json({ error: '患者姓名列表是必需的且不能为空' });
        }
        
        // 验证工作空间权限
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: '工作空间不存在' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权访问此工作空间' });
        }
        
        const result = await LabReport.findByPatientsItemsAndDateRange(
            patients,
            itemNames,
            startDate,
            endDate,
            workspaceId,
            parseInt(page),
            parseInt(pageSize)
        );
        
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// 创建新的检验报告
router.post('/', authenticateJWT, async (req, res, next) => {
    try {
        const labReportData = req.body;
        
        // 验证工作空间权限
        const workspace = await Workspace.findById(labReportData.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: '工作空间不存在' });
        }
        
        if (Number(workspace.userId) !== Number(req.user.id)) {
            return res.status(403).json({ error: '无权在此工作空间创建检验报告' });
        }
        
        const labReport = await LabReport.createWithItems(labReportData);
        res.status(201).json(labReport);
    } catch (error) {
        next(error);
    }
});

module.exports = router; 