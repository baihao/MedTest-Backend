# VS Code 调试指南

## 调试配置说明

### 1. Debug Server
- **用途**: 调试主服务器应用
- **启动**: 按 F5 或选择 "Debug Server"
- **断点**: 在 `index.js` 或路由文件中设置断点

### 2. Debug All Tests
- **用途**: 调试所有测试文件
- **启动**: 选择 "Debug All Tests"
- **断点**: 在任何测试文件中设置断点

### 3. Debug Current Test File
- **用途**: 调试当前打开的测试文件
- **启动**: 在测试文件中按 F5 或选择 "Debug Current Test File"
- **要求**: 必须先打开要调试的测试文件
- **适用**: 任何测试文件（user.test.js, workspace.test.js, jwt-auth.test.js 等）

### 4. Debug Specific Test
- **用途**: 调试特定的测试用例
- **启动**: 选择 "Debug Specific Test"，输入测试名称模式
- **示例**: 输入 "应成功创建工作空间" 来调试特定测试

### 5. Attach to Node Process
- **用途**: 连接到已运行的 Node.js 进程
- **启动**: 先运行 `node --inspect-brk` 命令，然后选择此配置

## 任务配置说明

### 1. Run All Tests
- **用途**: 运行所有测试文件
- **启动**: Ctrl+Shift+P → "Tasks: Run Task" → "Run All Tests"

### 2. Run Current Test File
- **用途**: 运行当前打开的测试文件
- **启动**: 在测试文件中，Ctrl+Shift+P → "Tasks: Run Task" → "Run Current Test File"
- **适用**: 任何测试文件

### 3. Run Tests with Coverage
- **用途**: 运行测试并生成覆盖率报告
- **启动**: Ctrl+Shift+P → "Tasks: Run Task" → "Run Tests with Coverage"

### 4. Run Tests in Watch Mode
- **用途**: 以监视模式运行测试（文件变化时自动重新运行）
- **启动**: Ctrl+Shift+P → "Tasks: Run Task" → "Run Tests in Watch Mode"

## 调试技巧

### 设置断点
1. 点击行号左侧设置断点
2. 右键断点可以设置条件或日志
3. 使用 `debugger;` 语句在代码中设置断点

### 调试控制
- **Continue (F5)**: 继续执行到下一个断点
- **Step Over (F10)**: 执行当前行，不进入函数
- **Step Into (F11)**: 进入函数内部
- **Step Out (Shift+F11)**: 跳出当前函数
- **Restart (Ctrl+Shift+F5)**: 重新开始调试
- **Stop (Shift+F5)**: 停止调试

### 查看变量
- **Variables**: 查看当前作用域的变量
- **Watch**: 添加要监视的表达式
- **Call Stack**: 查看函数调用栈
- **Breakpoints**: 管理所有断点

### 调试控制台
- 在 Debug Console 中执行表达式
- 查看变量值: `req.user.id`
- 执行函数: `console.log(testUser)`

## 常见调试场景

### 1. 调试 API 路由
```javascript
// 在 routes/workspace.js 中设置断点
router.post('/create', authenticateJWT, async (req, res) => {
    debugger; // 设置断点
    // 检查 req.user.id, req.body.name 等
});
```

### 2. 调试模型方法
```javascript
// 在 models/workspace.js 中设置断点
static async create(workspaceData) {
    debugger; // 设置断点
    // 检查 workspaceData, 数据库查询结果等
}
```

### 3. 调试测试用例
```javascript
// 在测试文件中设置断点
it('应成功创建工作空间', async () => {
    debugger; // 设置断点
    const res = await request(server)
        .post('/workspace/create')
        .set('Authorization', testToken)
        .send({ name: '测试工作空间' });
    // 检查 res.statusCode, res.body 等
});
```

### 4. 调试中间件
```javascript
// 在 config/midware.js 中设置断点
function authenticateJWT(req, res, next) {
    debugger; // 设置断点
    // 检查 token, req.headers 等
}
```

## 快速调试工作流

### 调试单个测试文件
1. 打开要调试的测试文件（如 `tests/workspace.test.js`）
2. 设置断点
3. 按 `F5` 或选择 "Debug Current Test File"
4. 使用调试控制按钮逐步执行

### 运行单个测试文件
1. 打开要运行的测试文件
2. Ctrl+Shift+P → "Tasks: Run Task" → "Run Current Test File"

### 调试特定测试用例
1. 选择 "Debug Specific Test"
2. 输入测试名称模式（如 "应成功创建工作空间"）
3. 设置断点并开始调试

## 环境变量

调试时自动设置的环境变量：
- `NODE_ENV=test`: 测试环境
- `NODE_ENV=development`: 开发环境

## 故障排除

### 1. 断点不生效
- 确保文件路径正确
- 检查是否有语法错误
- 重启调试会话

### 2. 无法连接到调试器
- 检查端口是否被占用
- 确保防火墙允许连接
- 尝试使用不同的端口

### 3. 测试运行缓慢
- 使用 `--runInBand` 参数
- 避免在测试中设置过多断点
- 使用条件断点减少暂停次数

## 快捷键

- `F5`: 开始/继续调试
- `F9`: 切换断点
- `F10`: 单步跳过
- `F11`: 单步进入
- `Shift+F11`: 单步跳出
- `Ctrl+Shift+F5`: 重启调试
- `Shift+F5`: 停止调试
- `Ctrl+Shift+P`: 打开命令面板 