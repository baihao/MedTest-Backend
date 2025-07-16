const express = require('express');
const { OcrData, OcrDataError } = require('../models/ocrdata');
const { Workspace } = require('../models/workspace');
const { authenticateJWT, detailedLogger, errorHandler } = require('../config/midware');
const { logger } = require('../config/logger');

const router = express.Router();

// 使用详细日志中间件
router.use(detailedLogger);

/**
 * POST /ocrdata/batch/:workspaceId - 批量上传OCR数据到指定工作空间
 * 
 * 请求体格式:
 * {
 *   "ocrDataArray": [
 *     {
 *       "reportImage": "path/to/image1.jpg",
 *       "ocrPrimitive": "OCR识别结果1"
 *     },
 *     {
 *       "reportImage": "path/to/image2.jpg", 
 *       "ocrPrimitive": "OCR识别结果2"
 *     }
 *   ]
 * }
 * 
 * 响应格式:
 * {
 *   "success": true,
 *   "message": "批量上传成功",
 *   "data": {
 *     "createdCount": 2,
 *     "workspaceId": 1,
 *     "workspaceName": "测试工作空间",
 *     "ocrData": [
 *       {
 *         "id": 1,
 *         "reportImage": "path/to/image1.jpg",
 *         "workspaceId": 1,
 *         "createdAt": "2024-01-01T00:00:00.000Z",
 *         "updatedAt": "2024-01-01T00:00:00.000Z"
 *       }
 *     ]
 *   }
 * }
 */
router.post('/batch/:workspaceId', authenticateJWT, async (req, res, next) => {
    try {
        const { ocrDataArray } = req.body;
        const { workspaceId } = req.params;
        const userId = req.user.id;

        // 验证工作空间ID
        if (!workspaceId || isNaN(Number(workspaceId))) {
            return res.status(400).json({
                success: false,
                message: '工作空间ID必须是有效的数字'
            });
        }

        // 验证请求体
        if (!ocrDataArray || !Array.isArray(ocrDataArray)) {
            return res.status(400).json({
                success: false,
                message: 'OCR数据数组是必需的且必须是数组格式'
            });
        }

        if (ocrDataArray.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'OCR数据数组不能为空'
            });
        }

        // 限制批量上传数量
        if (ocrDataArray.length > 100) {
            return res.status(400).json({
                success: false,
                message: '批量上传数量不能超过100条'
            });
        }

        // 验证工作空间是否存在且用户有权限
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: '工作空间不存在'
            });
        }

        if (workspace.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '没有权限访问该工作空间'
            });
        }

        // 为每个OCR数据添加工作空间ID
        const ocrDataWithWorkspace = ocrDataArray.map(ocrData => ({
            ...ocrData,
            workspaceId: Number(workspaceId)
        }));

        // 批量创建OCR数据
        const createdOcrData = await OcrData.createBatch(ocrDataWithWorkspace);

        logger.info(`用户 ${userId} 在工作空间 ${workspaceId} 中批量上传了 ${createdOcrData.length} 条OCR数据`);

        res.status(201).json({
            success: true,
            message: '批量上传成功',
            data: {
                createdCount: createdOcrData.length,
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                ocrData: createdOcrData.map(ocrData => ({
                    id: ocrData.id,
                    reportImage: ocrData.reportImage,
                    workspaceId: ocrData.workspaceId,
                    createdAt: ocrData.createdAt,
                    updatedAt: ocrData.updatedAt
                }))
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /ocrdata/workspace/:workspaceId - 获取工作空间的OCR数据列表
 */
router.get('/workspace/:workspaceId', authenticateJWT, async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const { limit = 100, offset = 0 } = req.query;
        const userId = req.user.id;

        // 验证工作空间ID
        if (!workspaceId || isNaN(Number(workspaceId))) {
            return res.status(400).json({
                success: false,
                message: '工作空间ID必须是有效的数字'
            });
        }

        // 验证用户对工作空间的权限
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: '工作空间不存在'
            });
        }

        if (workspace.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '没有权限访问该工作空间'
            });
        }

        // 获取OCR数据
        const ocrDataList = await OcrData.findByWorkspaceId(
            Number(workspaceId),
            Number(limit),
            Number(offset)
        );

        res.status(200).json({
            success: true,
            message: '获取成功',
            data: {
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                totalCount: ocrDataList.length,
                limit: Number(limit),
                offset: Number(offset),
                ocrData: ocrDataList.map(ocrData => ({
                    id: ocrData.id,
                    reportImage: ocrData.reportImage,
                    workspaceId: ocrData.workspaceId,
                    createdAt: ocrData.createdAt,
                    updatedAt: ocrData.updatedAt
                }))
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /ocrdata/:id - 获取单个OCR数据详情
 */
router.get('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 验证ID
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({
                success: false,
                message: 'OCR数据ID必须是有效的数字'
            });
        }

        // 获取OCR数据
        const ocrData = await OcrData.findById(Number(id));
        if (!ocrData) {
            return res.status(404).json({
                success: false,
                message: 'OCR数据不存在'
            });
        }

        // 验证用户对工作空间的权限
        const workspace = await Workspace.findById(ocrData.workspaceId);
        if (!workspace || workspace.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: '没有权限访问该OCR数据'
            });
        }

        res.status(200).json({
            success: true,
            message: '获取成功',
            data: {
                id: ocrData.id,
                reportImage: ocrData.reportImage,
                workspaceId: ocrData.workspaceId,
                workspaceName: workspace.name,
                createdAt: ocrData.createdAt,
                updatedAt: ocrData.updatedAt
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /ocrdata/batch - 批量删除OCR数据
 */
router.delete('/batch', authenticateJWT, async (req, res, next) => {
    try {
        const { idArray } = req.body;
        const userId = req.user.id;

        // 验证请求体
        if (!idArray || !Array.isArray(idArray)) {
            return res.status(400).json({
                success: false,
                message: 'ID数组是必需的且必须是数组格式'
            });
        }

        if (idArray.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'ID数组不能为空'
            });
        }

        // 限制批量删除数量
        if (idArray.length > 100) {
            return res.status(400).json({
                success: false,
                message: '批量删除数量不能超过100条'
            });
        }

        // 验证用户对所有OCR数据的权限
        const ocrDataList = await Promise.all(
            idArray.map(id => OcrData.findById(Number(id)))
        );

        const validOcrData = ocrDataList.filter(data => data !== null);
        if (validOcrData.length !== idArray.length) {
            return res.status(404).json({
                success: false,
                message: '部分OCR数据不存在'
            });
        }

        // 验证用户对工作空间的权限
        const workspaceIds = [...new Set(validOcrData.map(data => data.workspaceId))];
        const workspaces = await Promise.all(
            workspaceIds.map(id => Workspace.findById(id))
        );

        const userWorkspaces = workspaces.filter(ws => ws && ws.userId === userId);
        const userWorkspaceIds = userWorkspaces.map(ws => ws.id);

        const unauthorizedOcrData = validOcrData.filter(
            data => !userWorkspaceIds.includes(data.workspaceId)
        );

        if (unauthorizedOcrData.length > 0) {
            return res.status(403).json({
                success: false,
                message: '没有权限删除部分OCR数据'
            });
        }

        // 批量删除OCR数据
        const result = await OcrData.deleteBatch(idArray);

        logger.info(`用户 ${userId} 批量删除了 ${result.deletedCount} 条OCR数据`);

        res.status(200).json({
            success: true,
            message: '批量删除成功',
            data: {
                deletedCount: result.deletedCount,
                deletedIds: result.deletedIds
            }
        });

    } catch (error) {
        next(error);
    }
});

// 使用错误处理中间件
router.use(errorHandler);

module.exports = router; 