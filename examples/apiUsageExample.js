const axios = require('axios');

// 示例：使用Alibaba Cloud DashScope API调用DeepSeek模型
async function exampleApiCall() {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    const baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    
    if (!apiKey) {
        console.error('请设置 DASHSCOPE_API_KEY 环境变量');
        return;
    }

    const requestBody = {
        model: 'deepseek-r1',
        messages: [
            {
                role: 'user',
                content: '你好，请介绍一下你自己'
            }
        ],
        temperature: 0.1,
        max_tokens: 1000,
        top_p: 0.8
    };

    try {
        console.log('发送API请求到Alibaba Cloud DashScope...');
        
        const response = await axios.post(baseUrl, requestBody, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-SSE': 'disable'
            }
        });

        const result = response.data;
        
        if (result.error) {
            console.error('API返回错误:', result.error);
            return;
        }

        console.log('API响应成功:');
        console.log('模型:', result.model);
        console.log('使用情况:', result.usage);
        console.log('回复内容:', result.choices[0].message.content);
        
    } catch (error) {
        if (error.response) {
            console.error('API请求失败:', error.response.status, error.response.statusText);
            console.error('错误详情:', error.response.data);
        } else if (error.request) {
            console.error('网络请求失败:', error.message);
        } else {
            console.error('请求配置错误:', error.message);
        }
    }
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
    exampleApiCall();
}

module.exports = { exampleApiCall }; 