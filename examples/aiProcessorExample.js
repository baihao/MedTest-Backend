const AiProcessor = require('../processor/aiProcessor');

// 示例OCR数据
const sampleOcrData = [
    {
        "totalTextsFound": 149,
        "imageName": "test1.jpg",
        "textResults": [
            {
                "box": {
                    "y": 55,
                    "w": 106,
                    "h": 19,
                    "x": 43
                },
                "text": "第1页/共1页"
            },
            {
                "text": "全血细胞计数+5分类+C-反应蛋白（CRP）",
                "box": {
                    "x": 230,
                    "w": 300,
                    "h": 22,
                    "y": 52
                }
            },
            {
                "text": "牛霞",
                "box": {
                    "w": 38,
                    "h": 22,
                    "x": 652,
                    "y": 55
                }
            },
            {
                "box": {
                    "y": 74,
                    "w": 332,
                    "x": 368,
                    "h": 31
                },
                "text": "北京大学人民医院检验报告单"
            },
            {
                "text": "姓名：牛霞",
                "box": {
                    "w": 84,
                    "h": 21,
                    "x": 43,
                    "y": 149
                }
            },
            {
                "text": "报告时间：2025-03-22 15:52",
                "box": {
                    "w": 230,
                    "h": 19,
                    "x": 821,
                    "y": 708
                }
            },
            {
                "text": "申请医生：任媛",
                "box": {
                    "h": 24,
                    "w": 121,
                    "y": 171,
                    "x": 909
                }
            },
            {
                "text": "WBC",
                "box": {
                    "w": 26,
                    "x": 48,
                    "y": 246,
                    "h": 14
                }
            },
            {
                "box": {
                    "w": 87,
                    "h": 17,
                    "y": 244,
                    "x": 96
                },
                "text": "*白细胞计数"
            },
            {
                "text": "7.65",
                "box": {
                    "h": 14,
                    "x": 264,
                    "y": 246,
                    "w": 31
                }
            },
            {
                "box": {
                    "h": 14,
                    "w": 46,
                    "y": 246,
                    "x": 383
                },
                "text": "10^9/L"
            },
            {
                "text": "3.5-9.5",
                "box": {
                    "x": 492,
                    "w": 53,
                    "h": 14,
                    "y": 246
                }
            }
        ]
    }
];

async function exampleUsage() {
    try {
        // 检查环境变量
        if (!process.env.DASHSCOPE_API_KEY) {
            console.error('请设置 DASHSCOPE_API_KEY 环境变量');
            console.log('示例: export DASHSCOPE_API_KEY="your-api-key-here"');
            return;
        }

        console.log('开始AI处理示例...');
        
        // 创建AiProcessor实例
        const aiProcessor = new AiProcessor();
        
        // 将OCR数据转换为JSON字符串
        const ocrDataJson = JSON.stringify(sampleOcrData);
        
        // 处理OCR数据
        const labReportInstances = await aiProcessor.processOcrDataList(ocrDataJson);
        
        console.log('处理完成！生成的LabReport实例:');
        console.log(JSON.stringify(labReportInstances, null, 2));
        
        // 显示统计信息
        console.log(`\n统计信息:`);
        console.log(`- 处理的OCR数据数量: ${sampleOcrData.length}`);
        console.log(`- 生成的LabReport实例数量: ${labReportInstances.length}`);
        
        if (labReportInstances.length > 0) {
            const firstReport = labReportInstances[0];
            console.log(`- 第一个报告的患者姓名: ${firstReport.patient}`);
            console.log(`- 第一个报告的检验项目数量: ${firstReport.items.length}`);
        }
        
    } catch (error) {
        console.error('处理失败:', error.message);
        console.error('详细错误:', error);
    }
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
    exampleUsage();
}

module.exports = { exampleUsage, sampleOcrData }; 