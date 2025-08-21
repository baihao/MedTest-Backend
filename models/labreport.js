const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');

// 自定义错误类
class LabReportError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'LabReportError';
        this.statusCode = statusCode;
    }
}

class LabReport {
    constructor({ id, patient, reportTime, doctor, reportImage, hospital, workspaceId, ocrdataId, createdAt, updatedAt }) {
        this.id = id;
        this.patient = patient;
        this.reportTime = reportTime;
        this.doctor = doctor;
        this.reportImage = reportImage;
        this.hospital = hospital;
        this.workspaceId = workspaceId;
        this.ocrdataId = ocrdataId || null;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    static async init() {
        // 使用共享的数据库连接
        this.model = sequelize.define('LabReport', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            patient: {
                type: DataTypes.STRING(100),
                allowNull: false,
                validate: {
                    len: [1, 100],
                    notEmpty: true
                }
            },
            reportTime: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'report_time',
                validate: {
                    isDate: true,
                    notNull: true
                }
            },
            doctor: {
                type: DataTypes.STRING(100),
                allowNull: true, // 改为允许为空
                validate: {
                    len: [0, 100] // 修改验证规则，允许空字符串
                }
            },
            reportImage: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'report_image',
                validate: {
                    len: [0, 500]
                }
            },
            hospital: {
                type: DataTypes.STRING(200),
                allowNull: true, // 改为允许为空
                validate: {
                    len: [0, 200] // 修改验证规则，允许空字符串
                }
            },
            ocrdataId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'ocrdata_id',
                references: {
                    model: 'ocr_data',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                validate: {
                    isInt: true,
                    min: 1
                }
            },
            workspaceId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'workspace_id',
                references: {
                    model: 'workspaces',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                validate: {
                    isInt: true,
                    min: 1
                }
            }
        }, {
            tableName: 'lab_reports',
            timestamps: true,
            indexes: [
                {
                    fields: ['workspace_id']
                },
                {
                    fields: ['patient']
                },
                {
                    fields: ['report_time']
                },
                {
                    fields: ['doctor']
                },
                {
                    fields: ['ocrdata_id']
                }
            ]
        });
    }

    // 数据验证方法
    static validateLabReportData(labReportData) {
        const { patient, reportTime, doctor, reportImage, hospital, workspaceId, ocrdataId } = labReportData;
        
        if (!patient || typeof patient !== 'string') {
            throw new LabReportError('患者姓名是必需的且必须是字符串');
        }
        
        if (patient.trim().length === 0) {
            throw new LabReportError('患者姓名不能为空');
        }
        
        if (patient.length > 100) {
            throw new LabReportError('患者姓名长度不能超过100个字符');
        }
        
        if (!reportTime) {
            throw new LabReportError('报告时间是必需的');
        }
        
        // 验证日期格式
        const reportDate = new Date(reportTime);
        if (isNaN(reportDate.getTime())) {
            throw new LabReportError('报告时间格式无效');
        }
        
        // 医生姓名验证（允许为空）
        if (doctor !== undefined && doctor !== null) {
            if (typeof doctor !== 'string') {
                throw new LabReportError('医生姓名必须是字符串');
            }
            
            if (doctor.length > 100) {
                throw new LabReportError('医生姓名长度不能超过100个字符');
            }
        }
        
        if (reportImage !== undefined && reportImage !== null) {
            if (typeof reportImage !== 'string') {
                throw new LabReportError('报告图片必须是字符串');
            }
            
            if (reportImage.length > 500) {
                throw new LabReportError('报告图片路径长度不能超过500个字符');
            }
        }
        
        // 医院名称验证（允许为空）
        if (hospital !== undefined && hospital !== null) {
            if (typeof hospital !== 'string') {
                throw new LabReportError('医院名称必须是字符串');
            }
            
            if (hospital.length > 200) {
                throw new LabReportError('医院名称长度不能超过200个字符');
            }
        }
        
        if (!workspaceId || isNaN(Number(workspaceId)) || Number(workspaceId) < 1) {
            throw new LabReportError('工作空间ID是必需的且必须是正整数');
        }

        if (ocrdataId !== undefined && ocrdataId !== null) {
            if (isNaN(Number(ocrdataId)) || Number(ocrdataId) < 1) {
                throw new LabReportError('ocrdataId必须是正整数');
            }
        }
    }

    // 创建检验报告
    static async createWithItems(labReportData) {
        try {
            console.log('labReportData.items', labReportData.items);
            console.log('labReportData.workspaceId', labReportData.workspaceId);
            // 数据验证
            this.validateLabReportData(labReportData);
            
            // 确保workspaceId是数字类型
            const workspaceId = Number(labReportData.workspaceId);
            if (isNaN(workspaceId)) {
                throw new LabReportError('工作空间ID必须是有效的数字');
            }
            
            // 验证工作空间是否存在
            const { Workspace } = require('./workspace');
            const workspace = await Workspace.findById(workspaceId);
            if (!workspace) {
                throw new LabReportError('指定的工作空间不存在', 404);
            }
            
            // 创建检验报告
            const createValues = {
                patient: labReportData.patient,
                reportTime: new Date(labReportData.reportTime),
                doctor: labReportData.doctor || null, // 允许为空
                reportImage: labReportData.reportImage || null,
                hospital: labReportData.hospital || null, // 允许为空
                workspaceId: workspaceId
            };
            if (labReportData.ocrdataId !== undefined) {
                createValues.ocrdataId = labReportData.ocrdataId || null;
            }
            const dbLabReport = await this.model.create(createValues);

            const labReport = new LabReport(dbLabReport.toJSON());

            if (labReportData.items && Array.isArray(labReportData.items) && labReportData.items.length > 0) {
                const { LabReportItem } = require('./labreportitem');
                // 为每个 item 添加 labReportId 字段
                const itemsWithLabReportId = labReportData.items.map(item => ({
                    ...item,
                    labReportId: dbLabReport.id
                }));
                const createdItems = await LabReportItem.createBatch(itemsWithLabReportId);
                labReport.items = createdItems;
                console.log('createdItems', createdItems);
            } else {
                // 如果没有items，设置空数组
                labReport.items = [];
            }

            return labReport;
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            // 添加更详细的错误信息
            logger.error('检验报告创建错误详情:', error);
            throw new LabReportError(`创建检验报告失败: ${error.message}`);
        }
    }

    // 根据ID查找检验报告（包含关联的检验项目）
    static async findByIdWithItems(id) {
        try {
            console.log('findByIdWithItems', id);
            if (!id || isNaN(Number(id))) {
                throw new LabReportError('检验报告ID参数无效');
            }

            const labReport = await this.model.findByPk(id);
            if (!labReport) {
                return null;
            }

            console.log('labReport', labReport);
            
            // 获取关联的检验项目
            const { LabReportItem } = require('./labreportitem');
            const items = await LabReportItem.findByLabReportId(id);
            console.log('items', items);
            
            // 构建包含items的JSON对象
            const reportJson = labReport.toJSON();
            reportJson.items = items.map(item => ({
                id: item.id,
                labReportId: item.labReportId,
                itemName: item.itemName,
                result: item.result,
                unit: item.unit,
                referenceValue: item.referenceValue,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            }));
            
            return reportJson;
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`查找检验报告失败: ${error.message}`);
        }
    }

    // 根据工作空间ID查找检验报告（支持分页）
    static async findByWorkspaceIdWithPagination(workspaceId, page = 1, pageSize = 20) {
        try {
            if (!workspaceId || isNaN(Number(workspaceId))) {
                throw new LabReportError('工作空间ID参数无效');
            }
            
            if (page < 1 || pageSize < 1 || pageSize > 100) {
                throw new LabReportError('分页参数无效，页码必须大于0，页大小必须在1-100之间');
            }
            
            const offset = (page - 1) * pageSize;
            
            const { count, rows } = await this.model.findAndCountAll({
                where: { workspaceId: Number(workspaceId) },
                order: [['reportTime', 'DESC'], ['createdAt', 'DESC']],
                limit: pageSize,
                offset: offset
            });
            
            const labReports = rows.map(lr => new LabReport(lr.toJSON()));
            
            return {
                reports: labReports,
                pagination: {
                    currentPage: page,
                    pageSize: pageSize,
                    totalCount: count,
                    totalPages: Math.ceil(count / pageSize),
                    hasNext: page * pageSize < count,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`查找工作空间检验报告失败: ${error.message}`);
        }
    }

    // 根据患者姓名列表、项目列表和时间范围查找检验报告（支持分页）
    // patients: 患者姓名列表，itemNames: 项目名称列表，startDate: 开始日期，endDate: 结束日期，workspaceId: 工作空间ID，page: 页码，pageSize: 每页数量
    // 如果itemNames为['all']，则返回所有项目
    // 如果patients为['all']，则返回所有患者
    static async findByPatientsItemsAndDateRange(patients, itemNames = null, startDate = null, endDate = null, workspaceId = null, page = 1, pageSize = 20) {
        try {
            // 验证参数
            if (!patients || !Array.isArray(patients) || patients.length === 0) {
                throw new LabReportError('患者姓名列表是必需的且不能为空');
            }
            
            if (page < 1 || pageSize < 1 || pageSize > 100) {
                throw new LabReportError('分页参数无效，页码必须大于0，页大小必须在1-100之间');
            }
            
            // 验证 itemNames 参数格式
            if (itemNames !== null && !Array.isArray(itemNames)) {
                throw new LabReportError('项目名称列表必须是数组');
            }
            
            // 构建查询条件
            const whereClause = {};
            if (Array.isArray(patients) && !patients.includes('all')) {
                whereClause.patient = {
                    [Op.in]: patients
                }
            }
            
            if (workspaceId) {
                whereClause.workspaceId = Number(workspaceId);
            }
            
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    throw new LabReportError('日期格式无效');
                }
                
                whereClause.reportTime = {
                    [Op.between]: [start, end]
                };
            }
            
            const offset = (page - 1) * pageSize;
            
            // 查询检验报告
            const { count, rows } = await this.model.findAndCountAll({
                where: whereClause,
                order: [['reportTime', 'DESC'], ['createdAt', 'DESC']],
                limit: pageSize,
                offset: offset
            });
            
            const labReports = rows.map(lr => new LabReport(lr.toJSON()));
            
            // 如果需要过滤项目，获取关联的检验项目
            if (itemNames && Array.isArray(itemNames) && itemNames.length > 0) {
                const shouldGetAll = itemNames.includes('all');
                const { LabReportItem } = require('./labreportitem');
                
                for (const report of labReports) {
                    const items = shouldGetAll 
                        ? await LabReportItem.findByLabReportId(report.id)
                        : await LabReportItem.findByLabReportId(report.id, itemNames);
                    report.items = items.map(item => ({
                        id: item.id,
                        labReportId: item.labReportId,
                        itemName: item.itemName,
                        result: item.result,
                        unit: item.unit,
                        referenceValue: item.referenceValue,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt
                    }));
                }
            }
            
            return {
                reports: labReports,
                pagination: {
                    currentPage: page,
                    pageSize: pageSize,
                    totalCount: count,
                    totalPages: Math.ceil(count / pageSize),
                    hasNext: page * pageSize < count,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`查找检验报告失败: ${error.message}`);
        }
    }

    // 根据检验报告ID列表查找检验报告, 返回的检验报告包含关联的检验项目
    static async findByReportIds(reportIds) {
        try {
            if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
                throw new LabReportError('检验报告ID列表是必需的且不能为空');
            }

            if (reportIds.length > 100) {
                throw new LabReportError('检验报告ID列表长度不能超过100');
            }

            const rows = await this.model.findAll({
                where: { id: { [Op.in]: reportIds } }
            });

            const labReports = rows.map(lr => new LabReport(lr.toJSON()));
            const { LabReportItem } = require('./labreportitem');
            for (const report of labReports) {
                const items = await LabReportItem.findByLabReportId(report.id);
                report.items = items.map(item => ({
                    id: item.id,
                    labReportId: item.labReportId,
                    itemName: item.itemName,
                    result: item.result,
                    unit: item.unit,
                    referenceValue: item.referenceValue,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                }));
            }

            return labReports;
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`查找检验报告失败: ${error.message}`);
        }
    }

    // 根据ID查找检验报告
    static async findById(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new LabReportError('检验报告ID参数无效');
            }
            
            const labReport = await this.model.findByPk(id);
            return labReport ? new LabReport(labReport.toJSON()) : null;
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`查找检验报告失败: ${error.message}`);
        }
    }

    // 根据工作空间查找检验报告（保持向后兼容）
    static async findByWorkspaceId(workspaceId) {
        try {
            if (!workspaceId || isNaN(Number(workspaceId))) {
                throw new LabReportError('工作空间ID参数无效');
            }
            
            const labReports = await this.model.findAll({
                where: { workspaceId: Number(workspaceId) },
                order: [['reportTime', 'DESC'], ['createdAt', 'DESC']]
            });
            
            return labReports.map(lr => new LabReport(lr.toJSON()));
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`查找工作空间检验报告失败: ${error.message}`);
        }
    }

    // 更新检验报告
    static async update(id, updateData) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new LabReportError('检验报告ID参数无效');
            }
            
            // 检查检验报告是否存在
            const labReport = await this.findById(id);
            if (!labReport) {
                throw new LabReportError('检验报告不存在', 404);
            }
            
            // 验证更新数据
            if (updateData.patient !== undefined) {
                if (!updateData.patient || typeof updateData.patient !== 'string') {
                    throw new LabReportError('患者姓名是必需的且必须是字符串');
                }
                
                if (updateData.patient.trim().length === 0) {
                    throw new LabReportError('患者姓名不能为空');
                }
                
                if (updateData.patient.length > 100) {
                    throw new LabReportError('患者姓名长度不能超过100个字符');
                }
            }
            
            if (updateData.reportTime !== undefined) {
                const reportDate = new Date(updateData.reportTime);
                if (isNaN(reportDate.getTime())) {
                    throw new LabReportError('报告时间格式无效');
                }
                updateData.reportTime = reportDate;
            }
            
            // 医生姓名验证（允许为空）
            if (updateData.doctor !== undefined) {
                if (updateData.doctor !== null && typeof updateData.doctor !== 'string') {
                    throw new LabReportError('医生姓名必须是字符串或null');
                }
                
                if (updateData.doctor !== null && updateData.doctor.length > 100) {
                    throw new LabReportError('医生姓名长度不能超过100个字符');
                }
            }
            
            // 医院名称验证（允许为空）
            if (updateData.hospital !== undefined) {
                if (updateData.hospital !== null && typeof updateData.hospital !== 'string') {
                    throw new LabReportError('医院名称必须是字符串或null');
                }
                
                if (updateData.hospital !== null && updateData.hospital.length > 200) {
                    throw new LabReportError('医院名称长度不能超过200个字符');
                }
            }
            
            // 更新检验报告
            const [updatedCount] = await this.model.update(updateData, {
                where: { id }
            });
            
            if (updatedCount === 0) {
                throw new LabReportError('检验报告更新失败', 500);
            }
            
            // 返回更新后的检验报告
            return await this.findById(id);
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`更新检验报告失败: ${error.message}`);
        }
    }

    // 删除检验报告
    static async delete(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new LabReportError('检验报告ID参数无效');
            }
            
            // 检查检验报告是否存在
            const labReport = await this.findById(id);
            if (!labReport) {
                // 不抛异常，直接返回 false
                return false;
            }
            
            const result = await this.model.destroy({
                where: { id }
            });
            
            return result > 0;
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`删除检验报告失败: ${error.message}`);
        }
    }

    // 批量操作创建labreport和labreportitem
    static async createBatchWithItems(labReportsData) {
        const transaction = await sequelize.transaction();
        
        try {
            const createdLabReports = [];

            if (!labReportsData || !Array.isArray(labReportsData) || labReportsData.length === 0) {
                throw new LabReportError('检验报告数据列表是必需的且不能为空');
            }
            
            for (const labReportData of labReportsData) {
                this.validateLabReportData(labReportData);

                if (isNaN(labReportData.workspaceId)) {
                    throw new LabReportError('工作空间ID必须是有效的数字');
                }
                
                // 验证工作空间是否存在
                const { Workspace } = require('./workspace');
                const workspace = await Workspace.findById(labReportData.workspaceId);
                if (!workspace) {
                    throw new LabReportError('指定的工作空间不存在', 404);
                }
                
                const createValues = {
                    patient: labReportData.patient,
                    reportTime: new Date(labReportData.reportTime),
                    doctor: labReportData.doctor || null, // 允许为空
                    reportImage: labReportData.reportImage || null,
                    hospital: labReportData.hospital || null, // 允许为空
                    workspaceId: Number(labReportData.workspaceId)
                };
                if (labReportData.ocrdataId !== undefined) {
                    createValues.ocrdataId = labReportData.ocrdataId || null;
                }
                const dbLabReport = await this.model.create(createValues, { transaction });

                const labReport = new LabReport(dbLabReport.toJSON());

                if (labReportData.items 
                    && Array.isArray(labReportData.items) 
                    && labReportData.items.length > 0) {
                    const { LabReportItem } = require('./labreportitem');
                    const itemsWithLabReportId = labReportData.items.map(item => ({
                        ...item,
                        labReportId: dbLabReport.id
                    }));
                    const createdItems = await LabReportItem.createBatch(itemsWithLabReportId, transaction);
                    labReport.items = createdItems;
                } else {
                    // 如果没有items，设置空数组
                    labReport.items = [];
                }
                
                createdLabReports.push(labReport);
            }
            
            await transaction.commit();
            return createdLabReports;
        } catch (error) {
            await transaction.rollback();
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`批量创建检验报告失败: ${error.message}`);
        }
    }

    // 统计方法
    static async countByWorkspaceId(workspaceId) {
        try {
            if (!workspaceId || isNaN(Number(workspaceId))) {
                throw new LabReportError('工作空间ID参数无效');
            }
            
            return await this.model.count({
                where: { workspaceId: Number(workspaceId) }
            });
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`统计工作空间检验报告失败: ${error.message}`);
        }
    }

    // 根据一组 ocrdataId 查询已处理的检验报告（可按工作空间过滤）
    static async findByOcrdataIds(ocrdataIds, workspaceId = null) {
        try {
            if (!ocrdataIds || !Array.isArray(ocrdataIds) || ocrdataIds.length === 0) {
                throw new LabReportError('ocrdataId列表是必需的且不能为空');
            }

            const numericIds = ocrdataIds
                .map(id => Number(id))
                .filter(id => !isNaN(id) && id > 0);

            if (numericIds.length === 0) {
                throw new LabReportError('ocrdataId列表必须包含有效的正整数');
            }

            const whereClause = { ocrdataId: { [Op.in]: numericIds } };
            if (workspaceId !== null && workspaceId !== undefined) {
                if (isNaN(Number(workspaceId)) || Number(workspaceId) < 1) {
                    throw new LabReportError('工作空间ID参数无效');
                }
                whereClause.workspaceId = Number(workspaceId);
            }

            const rows = await this.model.findAll({
                where: whereClause,
                order: [['reportTime', 'DESC'], ['createdAt', 'DESC']]
            });

            return rows.map(r => new LabReport(r.toJSON()));
        } catch (error) {
            if (error instanceof LabReportError) {
                throw error;
            }
            throw new LabReportError(`根据ocrdataId列表查询检验报告失败: ${error.message}`);
        }
    }
}

module.exports = { LabReport, LabReportError }; 