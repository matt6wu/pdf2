# PDF电子阅读器

一个基于Web的现代PDF阅读器应用，使用Mozilla PDF.js构建，提供清晰的高DPI显示和流畅的用户体验。

## 项目特性

### 核心功能
- **拖拽上传**: 支持直接拖拽PDF文件到页面进行加载
- **高质量渲染**: 集成Mozilla PDF.js v4.0.379，支持高DPI显示器清晰渲染
- **智能缩放**: 默认150%缩放提供舒适阅读体验，支持25%-400%缩放范围
- **缩略图导航**: 左侧边栏显示所有页面缩略图，点击快速跳转
- **自动滚动定位**: 跳转页面时缩略图侧边栏自动滚动到当前页面

### 交互体验
- **自然滚动**: 页面内自然滚动，到达边界时自动翻页
- **平滑动画**: 120ms快速淡入淡出页面转换效果
- **多种控制方式**: 
  - 滚轮翻页和缩放
  - 键盘快捷键导航
  - 触控板双指缩放
  - 按钮控制

### 界面设计
- **现代白色主题**: 简洁清爽的界面设计
- **响应式布局**: 适配不同屏幕尺寸
- **优化侧边栏**: 220px宽度，缩略图居中对齐
- **加载动画**: 平滑的加载过渡效果

## 技术实现

### 核心技术栈
- Mozilla PDF.js v4.0.379 - PDF渲染引擎
- HTML5 Canvas API - 高DPI画布渲染
- CSS3 过渡动画 - 流畅用户体验
- JavaScript ES6+ - 现代化代码结构

### 关键技术特性
1. **高DPI渲染优化**:
   ```javascript
   const devicePixelRatio = window.devicePixelRatio || 1;
   canvas.width = viewport.width * devicePixelRatio;
   canvas.height = viewport.height * devicePixelRatio;
   ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
   ```

2. **智能滚动边界检测**:
   ```javascript
   const atTop = scrollTop <= 0;
   const atBottom = scrollTop + clientHeight >= scrollHeight - 5;
   ```

3. **平滑动画系统**:
   ```css
   .pdf-canvas {
       transition: opacity 0.12s ease-in-out;
   }
   ```

4. **自动定位滚动**:
   ```javascript
   currentThumbnail.scrollIntoView({
       behavior: 'smooth',
       block: 'center'
   });
   ```

### 文件结构
```
pdf-reader/
├── index.html          # 主页面结构
├── css/
│   └── style.css       # 样式表（白色主题，响应式设计）
├── js/
│   └── main.js         # 核心JavaScript逻辑
├── lib/                # PDF.js库文件
│   └── build/
│       ├── pdf.mjs
│       └── pdf.worker.mjs
└── CLAUDE.md          # 项目文档
```

## 使用说明

### 启动应用
```bash
# 在项目目录下启动HTTP服务器
python3 -m http.server 6788 &
```

### 基本操作
1. **加载PDF**: 拖拽PDF文件到页面或点击"选择文件"按钮
2. **页面导航**: 
   - 使用滚轮在页面内滚动，到边界自动翻页
   - 点击左侧缩略图直接跳转
   - 使用上下箭头键翻页
3. **缩放控制**:
   - Ctrl/Cmd + 滚轮缩放
   - 点击+/-按钮
   - Ctrl/Cmd + 0重置到150%

### 快捷键
- `←/→` 或 `↑/↓`: 翻页
- `Ctrl/Cmd + +/-`: 缩放
- `Ctrl/Cmd + 0`: 重置缩放
- `Esc`: 切换侧边栏

## 最新更新

### v1.2 - 高DPI渲染优化
- 修复高DPI显示器上文字模糊问题
- 优化Canvas渲染清晰度
- 改进缩略图显示质量

### v1.1 - 用户界面优化
- 调整侧边栏宽度为220px
- 缩略图居中对齐
- 添加自动滚动定位功能

### v1.0 - 核心功能实现
- 基础PDF渲染和导航
- 拖拽上传功能
- 智能滚动翻页
- 淡入淡出动画效果

## 部署信息

- **GitHub仓库**: https://github.com/matt6wu/pdf2
- **本地端口**: 6788
- **PDF.js版本**: v4.0.379
- **默认缩放**: 150%
- **动画速度**: 120ms

🤖 Generated with [Claude Code](https://claude.ai/code)