const express = require('express');
const router = express.Router();
const { LabReportItem, LabReportItemError } = require('../models/labreportitem');
const { LabReport } = require('../models/labreport');
const { Workspace } = require('../models/workspace');
const { authenticateJWT, detailedLogger } = require('../config/midware');

// 使用详细日志中间件
router.use(detailedLogger);

/**
 * PUT /labreportitem/:id - 更新检验报告项目
 * 
 * 请求体格式:
 * {
 *   "itemName": "白细胞计数",
 *   "result": "7.65",
 *   "unit": "10^9/L",
 *   "referenceValue": "3.5-9.5"
 * }
 * 
 * 响应格式:
 * {
 *   "success": true,
 *   "message": "检验报告项目更新成功",
 *   "data": {
 *     "id": 1,
 *     "labReportId": 1,
 *     "itemName": "白细胞计数",
 *     "result": "7.65",
 *     "unit": "10^9/L",
 *     "referenceValue": "3.5-9.5",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.put('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const userId = req.user.id;

        // 验证ID
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({
                success: false,
                message: '检验报告项目ID必须是有效的数字'
            });
        }

        // 获取检验报告项目
        const labReportItem = await LabReportItem.findById(Number(id));
        if (!labReportItem) {
            return res.status(404).json({
                success: false,
                message: '检验报告项目不存在'
            });
        }

        // 获取关联的检验报告
        const labReport = await LabReport.findById(labReportItem.labReportId);
        if (!labReport) {
            return res.status(404).json({
                success: false,
                message: '关联的检验报告不存在'
            });
        }

        // 验证工作空间权限
        const workspace = await Workspace.findById(labReport.workspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: '工作空间不存在'
            });
        }

        if (Number(workspace.userId) !== Number(userId)) {
            return res.status(403).json({
                success: false,
                message: '没有权限修改此检验报告项目'
            });
        }

        // 更新检验报告项目
        const updatedItem = await LabReportItem.update(Number(id), updateData);

        res.status(200).json({
            success: true,
            message: '检验报告项目更新成功',
            data: {
                id: updatedItem.id,
                labReportId: updatedItem.labReportId,
                itemName: updatedItem.itemName,
                result: updatedItem.result,
                unit: updatedItem.unit,
                referenceValue: updatedItem.referenceValue,
                updatedAt: updatedItem.updatedAt
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /labreportitem/:id - 获取单个检验报告项目
 * 
 * 响应格式:
 * {
 *   "success": true,
 *   "message": "获取检验报告项目成功",
 *   "data": {
 *     "id": 1,
 *     "labReportId": 1,
 *     "itemName": "白细胞计数",
 *     "result": "7.65",
 *     "unit": "10^9/L",
 *     "referenceValue": "3.5-9.5",
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.get('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 验证ID
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({
                success: false,
                message: '检验报告项目ID必须是有效的数字'
            });
        }

        // 获取检验报告项目
        const labReportItem = await LabReportItem.findById(Number(id));
        if (!labReportItem) {
            return res.status(404).json({
                success: false,
                message: '检验报告项目不存在'
            });
        }

        // 获取关联的检验报告
        const labReport = await LabReport.findById(labReportItem.labReportId);
        if (!labReport) {
            return res.status(404).json({
                success: false,
                message: '关联的检验报告不存在'
            });
        }

        // 验证工作空间权限
        const workspace = await Workspace.findById(labReport.workspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: '工作空间不存在'
            });
        }

        if (Number(workspace.userId) !== Number(userId)) {
            return res.status(403).json({
                success: false,
                message: '没有权限访问此检验报告项目'
            });
        }

        res.status(200).json({
            success: true,
            message: '获取检验报告项目成功',
            data: {
                id: labReportItem.id,
                labReportId: labReportItem.labReportId,
                itemName: labReportItem.itemName,
                result: labReportItem.result,
                unit: labReportItem.unit,
                referenceValue: labReportItem.referenceValue,
                createdAt: labReportItem.createdAt,
                updatedAt: labReportItem.updatedAt
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /labreportitem/:id - 删除检验报告项目
 * 
 * 响应格式:
 * {
 *   "success": true,
 *   "message": "检验报告项目删除成功",
 *   "data": {
 *     "id": 1
 *   }
 * }
 */
router.delete('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 验证ID
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({
                success: false,
                message: '检验报告项目ID必须是有效的数字'
            });
        }

        // 获取检验报告项目
        const labReportItem = await LabReportItem.findById(Number(id));
        if (!labReportItem) {
            return res.status(404).json({
                success: false,
                message: '检验报告项目不存在'
            });
        }

        // 获取关联的检验报告
        const labReport = await LabReport.findById(labReportItem.labReportId);
        if (!labReport) {
            return res.status(404).json({
                success: false,
                message: '关联的检验报告不存在'
            });
        }

        // 验证工作空间权限
        const workspace = await Workspace.findById(labReport.workspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: '工作空间不存在'
            });
        }

        if (Number(workspace.userId) !== Number(userId)) {
            return res.status(403).json({
                success: false,
                message: '没有权限删除此检验报告项目'
            });
        }

        // 删除检验报告项目
        const deleted = await LabReportItem.delete(Number(id));
        if (!deleted) {
            return res.status(500).json({
                success: false,
                message: '检验报告项目删除失败'
            });
        }

        res.status(200).json({
            success: true,
            message: '检验报告项目删除成功',
            data: {
                id: Number(id)
            }
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router; 