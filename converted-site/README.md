# AnimeAI 转换版

这是一个将 React 项目转换为纯 HTML/CSS/JS 的版本。

## 文件结构

```
converted-site/
├── index-converted.html  # 主 HTML 文件（包含所有 CSS 和 JS）
├── assets/               # 图片资源文件夹
│   ├── hero-anime.jpg    # 英雄区域背景图
│   ├── gallery-1.jpg     # 作品展示图 1
│   ├── gallery-2.jpg     # 作品展示图 2
│   ├── gallery-3.jpg     # 作品展示图 3
│   ├── gallery-4.jpg     # 作品展示图 4
│   ├── gallery-5.jpg     # 作品展示图 5
│   └── gallery-6.jpg     # 作品展示图 6
└── README.md             # 本说明文件
```

## 使用方法

1. **直接在浏览器中打开**：
   - 双击 `index-converted.html` 文件
   - 或在浏览器中按 `Ctrl+O` 选择该文件

2. **作为本地网站运行**：
   - 可以使用任何静态文件服务器
   - 例如：`python -m http.server 8000`（在 converted-site 目录下运行）
   - 然后在浏览器中访问 `http://localhost:8000`

## 功能特点

- ✅ **完全离线**：不需要网络连接，所有资源都在本地
- ✅ **响应式设计**：支持桌面和移动端显示
- ✅ **交互功能**：
  - 移动端菜单切换
  - 浮动粒子动画
  - Toast 通知系统
  - Tooltip 工具提示
- ✅ **本地图片**：所有图片都使用本地资源

## 技术说明

- **HTML5**：语义化标签结构
- **CSS3**：自定义样式，使用 CSS 变量定义主题
- **JavaScript**：原生 ES6+，无外部依赖

## 原始项目

原始项目使用：
- React + TypeScript
- Vite 构建工具
- Tailwind CSS
- Shadcn UI 组件库

转换后的版本移除了这些依赖，直接使用纯前端技术实现相同功能。