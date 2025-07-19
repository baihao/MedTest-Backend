const OpenAI = require('openai');

// 示例：使用DeepSeek R1模型的推理能力
async function reasoningExample() {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!apiKey) {
        console.error('请设置 DASHSCOPE_API_KEY 环境变量');
        console.log('示例: export DASHSCOPE_API_KEY="your-api-key-here"');
        return;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    });

    try {
        console.log('发送推理请求到DeepSeek R1模型...');
        
        const completion = await openai.chat.completions.create({
            model: "deepseek-r1",
            messages: [
                { role: "user", content: "9.9和9.11谁大？请详细解释你的推理过程。" }
            ],
            temperature: 0.1,
            max_tokens: 1000
        });

        console.log('\n=== 推理过程 ===');
        console.log(completion.choices[0].message.reasoning_content);
        
        console.log('\n=== 最终答案 ===');
        console.log(completion.choices[0].message.content);
        
        console.log('\n=== 使用统计 ===');
        console.log('总Token数:', completion.usage.total_tokens);
        console.log('输入Token数:', completion.usage.input_tokens);
        console.log('输出Token数:', completion.usage.output_tokens);
        
    } catch (error) {
        console.error('请求失败:', error.message);
        if (error.response) {
            console.error('错误详情:', error.response.data);
        }
    }
}

// 医疗数据推理示例
async function medicalReasoningExample() {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!apiKey) {
        console.error('请设置 DASHSCOPE_API_KEY 环境变量');
        return;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    });

    const medicalData = `
    患者检验结果：
    - 白细胞计数：7.65 × 10^9/L (参考范围：3.5-9.5)
    - 红细胞计数：4.16 × 10^12/L (参考范围：3.80-5.10)
    - 血红蛋白：123 g/L (参考范围：115-150)
    - 血小板计数：332 × 10^9/L (参考范围：125-350)
    - C-反应蛋白：0.5 mg/L (参考范围：0-10)
    
    请分析这些检验结果是否正常，并解释每个指标的含义。
    `;

    try {
        console.log('\n=== 医疗数据推理示例 ===');
        console.log('发送医疗数据分析请求...');
        
        const completion = await openai.chat.completions.create({
            model: "deepseek-r1",
            messages: [
                { role: "user", content: medicalData }
            ],
            temperature: 0.1,
            max_tokens: 1500
        });

        console.log('\n=== 推理过程 ===');
        console.log(completion.choices[0].message.reasoning_content);
        
        console.log('\n=== 分析结果 ===');
        console.log(completion.choices[0].message.content);
        
    } catch (error) {
        console.error('医疗推理请求失败:', error.message);
    }
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
    reasoningExample().then(() => {
        return medicalReasoningExample();
    }).catch(console.error);
}

module.exports = { reasoningExample, medicalReasoningExample }; 