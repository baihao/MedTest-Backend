#!/usr/bin/env node

/**
 * 手动运行 AiProcessor E2E 测试脚本
 * 使用方法: node scripts/runAiProcessorE2ETest.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始运行 AiProcessor E2E 测试...\n');

try {
    // 运行特定的测试文件
    const testCommand = 'npm test -- tests/aiProcessorE2E.test.js --verbose';
    
    console.log(`执行命令: ${testCommand}\n`);
    
    const result = execSync(testCommand, {
        cwd: process.cwd(),
        stdio: 'inherit',
        encoding: 'utf8'
    });
    
    console.log('\n✅ AiProcessor E2E 测试完成!');
    
} catch (error) {
    console.error('\n❌ AiProcessor E2E 测试失败:');
    console.error(error.message);
    process.exit(1);
} 