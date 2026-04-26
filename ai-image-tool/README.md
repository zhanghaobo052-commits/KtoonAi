# AI Image Tool - 独立版本

这是一个独立的 AI 生图工具，可以单独运行，无需依赖其他文件。

## 文件结构

```
ai-image-tool/
├── new-page.html      # 主页面
├── server.js          # Node.js 服务器
├── start.bat          # Windows 启动脚本
├── css/
│   └── style.css      # 样式文件
└── js/
    └── script-new.js  # JavaScript 功能
```

## 启动方法

### 方法一：使用启动脚本（推荐）
1. 双击 `start.bat` 文件
2. 等待服务器启动
3. 在浏览器中访问：`http://localhost:8000/new-page.html`

### 方法二：手动启动
1. 打开命令提示符（CMD）
2. 进入 `ai-image-tool` 文件夹：
   ```bash
   cd "C:\Users\Administrator\Desktop\新建文件夹\ai-image-tool"
   ```
3. 启动服务器：
   ```bash
   node server.js
   ```
4. 在浏览器中访问：`http://localhost:8000/new-page.html`

## 功能特点

- ✅ **本地运行**：所有功能在本地运行，保护隐私
- ✅ **无需登录**：打开即用，无需注册
- ✅ **支持多种模型**：即梦、Nano-banana 等
- ✅ **代理功能**：自动处理 CORS 问题
- ✅ **独立打包**：所有依赖文件都在此文件夹中

## 注意事项

1. 确保已安装 Node.js
2. 首次使用时可能需要配置 API 密钥
3. 服务器默认端口为 8000，如需修改请编辑 `server.js`

## 技术支持

如果遇到问题，请检查：
- Node.js 是否正确安装
- 端口 8000 是否被占用
- 防火墙是否阻止了访问