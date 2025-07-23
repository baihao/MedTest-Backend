/**
 * LabReportItem API 使用示例
 * 
 * 这个示例展示了如何使用 LabReportItem API 来更新检验报告项目
 */

const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000';
const USERNAME = 'testuser';
const PASSWORD = 'password123';

// 存储认证信息
let authToken = null;
let workspaceId = null;
let labReportId = null;
let labReportItemId = null;

/**
 * 1. 用户登录获取token
 */
async function login() {
    try {
        console.log('🔐 正在登录...');
        const response = await axios.post(`${BASE_URL}/login`, {
            username: USERNAME,
            password: PASSWORD
        });
        
        authToken = response.data.token;
        console.log('✅ 登录成功，获取到token');
        return true;
    } catch (error) {
        console.error('❌ 登录失败:', error.response?.data || error.message);
        return false;
    }
}

/**
 * 2. 创建工作空间
 */
async function createWorkspace() {
    try {
        console.log('🏢 正在创建工作空间...');
        const response = await axios.post(`${BASE_URL}/workspace/create`, {
            name: '测试工作空间'
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        workspaceId = response.data.id;
        console.log(`✅ 工作空间创建成功，ID: ${workspaceId}`);
        return true;
    } catch (error) {
        console.error('❌ 创建工作空间失败:', error.response?.data || error.message);
        return false;
    }
}

/**
 * 3. 创建测试检验报告（包含项目）
 */
async function createLabReport() {
    try {
        console.log('📋 正在创建检验报告...');
        const response = await axios.post(`${BASE_URL}/labreport`, {
            patient: '张三',
            reportTime: new Date().toISOString(),
            doctor: '李医生',
            hospital: '人民医院',
            workspaceId: workspaceId,
            items: [
                {
                    itemName: '血常规',
                    result: '正常',
                    unit: 'g/L',
                    referenceValue: '3.5-9.5'
                },
                {
                    itemName: '血糖',
                    result: '5.2',
                    unit: 'mmol/L',
                    referenceValue: '3.9-6.1'
                }
            ]
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        labReportId = response.data.id;
        labReportItemId = response.data.items[0].id;
        console.log(`✅ 检验报告创建成功，ID: ${labReportId}`);
        console.log(`✅ 检验报告项目ID: ${labReportItemId}`);
        return true;
    } catch (error) {
        console.error('❌ 创建检验报告失败:', error.response?.data || error.message);
        return false;
    }
}

/**
 * 4. 获取检验报告项目详情
 */
async function getLabReportItem() {
    try {
        console.log('📖 正在获取检验报告项目详情...');
        const response = await axios.get(`${BASE_URL}/labreportitem/${labReportItemId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const item = response.data.data;
        console.log('✅ 获取成功:');
        console.log(`   项目名称: ${item.itemName}`);
        console.log(`   检验结果: ${item.result}`);
        console.log(`   单位: ${item.unit}`);
        console.log(`   参考值: ${item.referenceValue}`);
        return item;
    } catch (error) {
        console.error('❌ 获取检验报告项目失败:', error.response?.data || error.message);
        return null;
    }
}

/**
 * 5. 更新检验报告项目
 */
async function updateLabReportItem() {
    try {
        console.log('✏️ 正在更新检验报告项目...');
        const updateData = {
            result: '异常',
            unit: 'mg/dL',
            referenceValue: '4.0-10.0'
        };
        
        const response = await axios.put(`${BASE_URL}/labreportitem/${labReportItemId}`, updateData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const updatedItem = response.data.data;
        console.log('✅ 更新成功:');
        console.log(`   项目名称: ${updatedItem.itemName}`);
        console.log(`   检验结果: ${updatedItem.result} (已更新)`);
        console.log(`   单位: ${updatedItem.unit} (已更新)`);
        console.log(`   参考值: ${updatedItem.referenceValue} (已更新)`);
        return updatedItem;
    } catch (error) {
        console.error('❌ 更新检验报告项目失败:', error.response?.data || error.message);
        return null;
    }
}

/**
 * 6. 验证更新结果
 */
async function verifyUpdate() {
    try {
        console.log('🔍 正在验证更新结果...');
        const item = await getLabReportItem();
        
        if (item && item.result === '异常' && item.unit === 'mg/dL') {
            console.log('✅ 验证成功：字段已正确更新');
            return true;
        } else {
            console.log('❌ 验证失败：字段未正确更新');
            return false;
        }
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        return false;
    }
}

/**
 * 7. 按患者姓名查询检验报告
 */
async function searchLabReportsByPatient() {
    try {
        console.log('🔍 正在按患者姓名查询检验报告...');
        const response = await axios.post(`${BASE_URL}/labreport/search`, {
            workspaceId: workspaceId,
            patients: ['张三'],
            page: 1,
            pageSize: 10
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const reports = response.data.labReports;
        console.log(`✅ 查询成功，找到 ${reports.length} 个检验报告`);
        
        if (reports.length > 0) {
            const report = reports[0];
            console.log(`   患者: ${report.patient}`);
            console.log(`   报告ID: ${report.id}`);
            console.log(`   项目数量: ${report.items ? report.items.length : 0}`);
            
            if (report.items && report.items.length > 0) {
                const item = report.items.find(i => i.itemName === '血常规');
                if (item) {
                    console.log(`   血常规结果: ${item.result}`);
                    console.log(`   血常规单位: ${item.unit}`);
                }
            }
        }
        
        return reports;
    } catch (error) {
        console.error('❌ 查询检验报告失败:', error.response?.data || error.message);
        return [];
    }
}

/**
 * 主函数：执行完整的API测试流程
 */
async function main() {
    console.log('🚀 开始 LabReportItem API 测试流程\n');
    
    // 1. 登录
    if (!await login()) return;
    
    // 2. 创建工作空间
    if (!await createWorkspace()) return;
    
    // 3. 创建检验报告
    if (!await createLabReport()) return;
    
    // 4. 获取原始项目详情
    console.log('\n--- 原始数据 ---');
    await getLabReportItem();
    
    // 5. 更新项目
    console.log('\n--- 更新数据 ---');
    await updateLabReportItem();
    
    // 6. 验证更新结果
    console.log('\n--- 验证结果 ---');
    await verifyUpdate();
    
    // 7. 按患者姓名查询
    console.log('\n--- 查询验证 ---');
    await searchLabReportsByPatient();
    
    console.log('\n🎉 测试流程完成！');
}

// 运行示例
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    login,
    createWorkspace,
    createLabReport,
    getLabReportItem,
    updateLabReportItem,
    verifyUpdate,
    searchLabReportsByPatient
}; 