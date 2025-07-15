# PDF电子阅读器

一个基于Web的现代PDF阅读器应用，使用Mozilla PDF.js构建，提供清晰的高DPI显示和流畅的用户体验。

## 项目特性

### 核心功能
- **拖拽上传**: 支持直接拖拽PDF文件到页面进行加载
- **高质量渲染**: 集成Mozilla PDF.js v4.0.379，支持高DPI显示器清晰渲染
- **响应式缩放**: 自动适应屏幕大小，支持30%-300%缩放范围
- **交互式缩放滑块**: 右上角120px滑块，实时拖拽调节缩放比例
- **可调节侧边栏**: 默认250px宽度，可拖拽调整200px-400px范围
- **缩略图导航**: 左侧边栏显示所有页面缩略图，点击快速跳转
- **自动滚动定位**: 跳转页面时缩略图侧边栏自动滚动到当前页面
- **自适应缩略图**: 侧边栏宽度改变时缩略图自动调整大小
- **智能朗读功能**: 集成TTS语音合成，支持当前页面文本朗读

### 交互体验
- **自然滚动**: 页面内自然滚动，到达边界时自动翻页
- **平滑动画**: 120ms快速淡入淡出页面转换效果
- **多种控制方式**: 
  - 滚轮翻页和缩放
  - 键盘快捷键导航
  - 触控板双指缩放
  - 按钮控制
  - 交互式滑块拖拽缩放
  - 侧边栏宽度拖拽调节
  - 一键朗读当前页面

### 界面设计
- **现代白色主题**: 简洁清爽的界面设计
- **响应式布局**: 自动适应屏幕大小，PDF自然缩放
- **可调节侧边栏**: 默认250px宽度，可拖拽调整200px-400px
- **缩略图居中对齐**: 自适应大小，宽度变化时自动调整缩放
- **交互式缩放滑块**: 120px蓝色滑块，悬停效果，支持Chrome/Firefox
- **智能朗读按钮**: 位于工具栏的🔊按钮，支持TTS语音合成
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

5. **响应式缩放系统**:
   ```javascript
   const availableWidth = viewerContainer.clientWidth - 80;
   let newScale = availableWidth / pdfWidth;
   newScale = Math.max(0.3, Math.min(3.0, newScale));
   ```

6. **侧边栏拖拽调整**:
   ```javascript
   let newWidth = startWidth + deltaX;
   newWidth = Math.max(200, Math.min(400, newWidth));
   this.sidebar.style.width = newWidth + 'px';
   ```

7. **自适应缩略图缩放**:
   ```javascript
   const availableWidth = sidebarWidth - padding;
   let newScale = availableWidth < 200 ? 0.2 : 
                  availableWidth < 300 ? 0.3 : 0.35;
   ```

8. **智能朗读系统**:
   ```javascript
   // 提取PDF页面文本
   const page = await this.pdfDoc.getPage(this.pageNum);
   const textContent = await page.getTextContent();
   const pageText = textContent.items.map(item => item.str).join(' ');
   
   // 调用TTS API
   const ttsUrl = `https://tts.mattwu.cc/api/tts?text=${encodeURIComponent(pageText)}&speaker_id=p335`;
   const response = await fetch(ttsUrl);
   const audioBlob = await response.blob();
   
   // 播放生成的音频
   const audio = new Audio(URL.createObjectURL(audioBlob));
   await audio.play();
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
# 方式1: 使用PM2管理（推荐）
cd /home/ubuntu/app/pdf-reader
pm2 start "python3 -m http.server 6788" --name pdf-reader
pm2 save

# 方式2: 直接启动（临时）
python3 -m http.server 6788 &
```

### PM2管理命令
```bash
pm2 status              # 查看服务状态
pm2 logs pdf-reader     # 查看日志
pm2 restart pdf-reader  # 重启服务
pm2 stop pdf-reader     # 停止服务
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
   - 拖拽右上角滑块调节（30%-300%）
   - 自动适应屏幕大小
   - Ctrl/Cmd + 0重置到150%
4. **侧边栏调节**:
   - 拖拽右边缘调整宽度（200px-400px）
   - 缩略图自动适应大小
5. **朗读功能**:
   - 点击🔊按钮朗读当前页面
   - 朗读时按钮变为⏹️停止按钮
   - 自动提取页面文本并生成语音
   - 支持暂停和重新开始

### 快捷键
- `←/→` 或 `↑/↓`: 翻页
- `Ctrl/Cmd + +/-`: 缩放
- `Ctrl/Cmd + 0`: 重置缩放
- `Esc`: 切换侧边栏

## 最新更新

### v2.1 - 智能朗读功能
- 添加PDF文本提取和TTS语音合成功能
- 集成外部TTS API服务 (https://tts.mattwu.cc/)
- 实现CORS跨域支持，解决浏览器安全限制
- 添加朗读状态指示和控制按钮
- 支持朗读过程中的暂停和停止操作
- 翻页时自动停止当前朗读

### v2.0 - 响应式缩放和交互优化
- 添加交互式缩放滑块（30%-300%范围）
- 实现响应式PDF缩放，自动适应屏幕大小
- 可调节侧边栏宽度（200px-400px）
- 缩略图自适应大小调整
- 窗口大小改变时自动重新缩放
- 移除CSS变形，使用纯PDF.js自然缩放

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
- **缩放范围**: 30%-300%
- **侧边栏范围**: 200px-400px
- **动画速度**: 120ms
- **进程管理**: PM2

🤖 Generated with [Claude Code](https://claude.ai/code)