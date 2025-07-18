// PDF.js 配置
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/build/pdf.worker.mjs';

class PDFReader {
    constructor() {
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageCount = 0;
        this.scale = 1.5; // 默认150%缩放
        this.canvas = document.getElementById('pdfCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.sidebarOpen = true;
        this.wheelTimeout = null;
        this.scrollAccumulator = 0;
        this.scrollThreshold = 100; // 滚动累积阈值
        this.isReading = false; // 朗读状态
        this.isPaused = false; // 暂停状态
        this.currentAudio = null; // 当前播放的音频对象
        this.isReadingPanelMinimized = false; // 跟踪朗读面板是否被最小化
        
        // 时间统计相关状态
        this.appStartTime = Date.now(); // 应用启动时间
        this.totalUsageTime = 0; // 累积使用时间（毫秒）
        this.isTimeWidgetMinimized = false; // 时间浮标是否最小化
        this.timeUpdateInterval = null; // 时间更新定时器
        this.allAudios = []; // 所有音频实例列表
        this.preloadTimeouts = []; // 预加载定时器列表
        this.hoverTimeout = null; // 悬停防抖定时器
        this.scrollSaveTimeout = null; // 滚动保存防抖定时器
        this.autoNextPage = true; // 自动翻页开关
        this.readingPageNum = 1; // 当前朗读的页码
        this.currentSegmentIndex = 0; // 当前朗读段落索引
        this.totalSegmentCount = 0; // 总段落数
        this.currentRenderTask = null; // 当前渲染任务
        
        // 阅读记忆功能
        this.currentBookId = null; // 当前书籍ID
        this.currentBookName = null; // 当前书籍名称
        this.readingMemoryEnabled = true; // 阅读记忆功能开关
        
        // PDF本地存储功能
        this.dbName = 'PDFReaderDB';
        this.dbVersion = 1;
        this.db = null;
        this.currentPDFData = null; // 当前PDF的二进制数据
        
        this.initializeElements();
        this.initDB();
        this.setupEventListeners();
        this.setupWindowResize();
        this.initializeLanguageSwitch();
        this.initializeTimeTracking();
    }

    initializeElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.selectFileBtn = document.getElementById('selectFile');
        this.pdfViewer = document.getElementById('pdfViewer');
        this.pdfContainer = document.getElementById('pdfContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.sidebar = document.getElementById('sidebar');
        this.thumbnailContainer = document.getElementById('thumbnailContainer');
        this.pageInfo = document.getElementById('pageInfo');
        this.zoomLevel = document.getElementById('zoomLevel');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        this.zoomInBtn = document.getElementById('zoomIn');
        this.zoomOutBtn = document.getElementById('zoomOut');
        this.toggleSidebarBtn = document.getElementById('toggleSidebar');
        this.fitToWidthBtn = document.getElementById('fitToWidth');
        console.log('🔍 fitToWidthBtn 元素:', this.fitToWidthBtn);
        this.resizeHandle = document.getElementById('resizeHandle');
        this.zoomSlider = document.getElementById('zoomSlider');
        this.progressBar = document.getElementById('progressBar');
        this.homeBtn = document.getElementById('homeBtn');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.readAloudBtn = document.getElementById('readAloudBtn');
        this.stopReadingBtn = document.getElementById('stopReadingBtn');
        this.goToReadingPageBtn = document.getElementById('goToReadingPageBtn');
        this.languageToggleBtn = document.getElementById('languageToggleBtn');
        this.languageSwitchContainer = document.querySelector('.language-switch-container');
        this.readingContentPanel = document.getElementById('readingContentPanel');
        this.readingText = document.getElementById('readingText');
        this.currentSegment = document.getElementById('currentSegment');
        this.totalSegments = document.getElementById('totalSegments');
        this.readingProgressFill = document.getElementById('readingProgressFill');
        this.closeReadingPanel = document.getElementById('closeReadingPanel');
        this.minimizeReadingPanel = document.getElementById('minimizeReadingPanel');
        
        // 浮标相关元素
        this.readingFloatingWidget = document.getElementById('readingFloatingWidget');
        this.expandReadingPanel = document.getElementById('expandReadingPanel');
        this.closeFloatingWidget = document.getElementById('closeFloatingWidget');
        this.floatingCurrentSegment = document.getElementById('floatingCurrentSegment');
        this.floatingTotalSegments = document.getElementById('floatingTotalSegments');
        
        // TTS加载指示器相关元素
        this.ttsLoadingIndicator = document.getElementById('ttsLoadingIndicator');
        this.floatingWidgetIcon = document.getElementById('floatingWidgetIcon');
        this.floatingWidgetTitle = document.getElementById('floatingWidgetTitle');
        this.floatingWidgetProgress = document.getElementById('floatingWidgetProgress');
        
        // 时间统计相关元素
        this.timeTrackingWidget = document.getElementById('timeTrackingWidget');
        this.timeTrackingMiniWidget = document.getElementById('timeTrackingMiniWidget');
        this.localTimeDisplay = document.getElementById('localTimeDisplay');
        this.usageTimeDisplay = document.getElementById('usageTimeDisplay');
        this.miniLocalTime = document.getElementById('miniLocalTime');
        this.miniUsageTime = document.getElementById('miniUsageTime');
        this.minimizeTimeWidget = document.getElementById('minimizeTimeWidget');
        this.resetUsageTime = document.getElementById('resetUsageTime');
        this.expandTimeWidget = document.getElementById('expandTimeWidget');
        
        // 调试：检查按钮是否正确获取
        console.log('🔍 按钮初始化检查:');
        console.log('readAloudBtn:', this.readAloudBtn);
        console.log('stopReadingBtn:', this.stopReadingBtn);
        console.log('goToReadingPageBtn:', this.goToReadingPageBtn);
        console.log('readingContentPanel:', this.readingContentPanel);
        console.log('readingText:', this.readingText);
        console.log('dropZone:', this.dropZone);
        console.log('fileInput:', this.fileInput);
        this.uploadModal = document.getElementById('uploadModal');
        this.uploadDropZone = document.getElementById('uploadDropZone');
        this.uploadFileInput = document.getElementById('uploadFileInput');
        this.selectUploadFile = document.getElementById('selectUploadFile');
        this.closeUploadModal = document.getElementById('closeUploadModal');
    }

    setupEventListeners() {
        // 文件选择事件
        this.selectFileBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // 拖拽事件
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));

        // 导航按钮
        this.prevPageBtn.addEventListener('click', () => this.goToPreviousPage());
        this.nextPageBtn.addEventListener('click', () => this.goToNextPage());

        // 缩放按钮
        this.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        
        // 缩放滑块
        this.zoomSlider.addEventListener('input', (e) => this.handleSliderZoom(e));
        this.zoomSlider.addEventListener('change', (e) => this.handleSliderZoom(e));

        // 侧边栏切换
        this.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        
        // 适应屏幕宽度
        this.fitToWidthBtn.addEventListener('click', () => {
            console.log('🖱️ Fit按钮被点击');
            this.fitToWidth();
        });
        
        // 首页按钮
        this.homeBtn.addEventListener('click', () => this.goHome());
        
        // 语言切换开关
        this.languageToggleBtn.addEventListener('change', () => this.toggleLanguage());
        
        // 朗读按钮 - 智能触发（根据状态决定是否支持悬停）
        this.readAloudBtn.addEventListener('mouseenter', () => this.handleHoverTrigger());
        this.readAloudBtn.addEventListener('mouseleave', () => this.clearHoverTimeout());
        
        // 点击事件（所有状态都支持）
        this.readAloudBtn.addEventListener('click', () => this.toggleReadAloud());
        
        // 停止朗读按钮 - 只支持点击
        this.stopReadingBtn.addEventListener('click', () => this.forceStopReading());
        
        // 回到朗读页面按钮 - 只支持点击
        this.goToReadingPageBtn.addEventListener('click', () => this.goToReadingPage());
        
        // 朗读内容框关闭按钮
        this.closeReadingPanel.addEventListener('click', () => this.hideReadingContentPanel());
        
        // 朗读内容框最小化按钮
        this.minimizeReadingPanel.addEventListener('click', () => this.minimizeReadingContentPanel());
        
        // 浮标展开按钮
        this.expandReadingPanel.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            this.expandReadingContentPanel();
        });
        
        // 浮标关闭按钮
        this.closeFloatingWidget.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            this.hideFloatingWidget();
        });
        
        // 整个浮标点击展开
        this.readingFloatingWidget.addEventListener('click', () => this.expandReadingContentPanel());
        
        // 时间统计浮标事件
        this.minimizeTimeWidget.addEventListener('click', (e) => {
            e.stopPropagation();
            this.minimizeTimeTrackingWidget();
        });
        
        this.resetUsageTime.addEventListener('click', (e) => {
            e.stopPropagation();
            this.resetUsageTimeCounter();
        });
        
        this.expandTimeWidget.addEventListener('click', (e) => {
            e.stopPropagation();
            this.expandTimeTrackingWidget();
        });
        
        // 时间最小化浮标整体点击
        this.timeTrackingMiniWidget.addEventListener('click', () => this.expandTimeTrackingWidget());
        
        // 朗读内容框拖拽功能
        this.setupReadingPanelDrag();
        
        // 上传按钮和弹框
        this.uploadBtn.addEventListener('click', () => this.showUploadModal());
        this.closeUploadModal.addEventListener('click', () => this.hideUploadModal());
        this.uploadModal.addEventListener('click', (e) => {
            if (e.target === this.uploadModal) this.hideUploadModal();
        });
        
        // 上传弹框文件选择
        this.selectUploadFile.addEventListener('click', () => this.uploadFileInput.click());
        this.uploadFileInput.addEventListener('change', (e) => this.handleUploadFileSelect(e));
        
        // 上传弹框拖拽
        this.uploadDropZone.addEventListener('dragover', (e) => this.handleUploadDragOver(e));
        this.uploadDropZone.addEventListener('dragleave', (e) => this.handleUploadDragLeave(e));
        this.uploadDropZone.addEventListener('drop', (e) => this.handleUploadDrop(e));
        this.uploadDropZone.addEventListener('click', () => this.uploadFileInput.click());

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // 滚轮翻页功能
        this.pdfContainer.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // 滚动事件监听器，用于保存滚动位置
        this.pdfContainer.addEventListener('scroll', () => this.handleScroll());
        
        // 侧边栏调整大小
        this.setupSidebarResize();
    }

    setupSidebarResize() {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        this.resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = this.sidebar.offsetWidth;
            this.resizeHandle.classList.add('resizing');
            
            // 防止选中文本
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            let newWidth = startWidth + deltaX;
            
            // 限制最小和最大宽度
            newWidth = Math.max(200, Math.min(400, newWidth));
            
            this.sidebar.style.width = newWidth + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                this.resizeHandle.classList.remove('resizing');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                
                // 触发缩略图大小调整 - 添加延迟确保DOM更新完成
                setTimeout(() => {
                    this.adjustThumbnailSize();
                }, 100);
            }
        });
    }

    adjustThumbnailSize() {
        if (!this.pdfDoc) return;
        
        const sidebarWidth = this.sidebar.offsetWidth;
        const padding = 32; // 1rem padding * 2 + border + margin
        const availableWidth = sidebarWidth - padding;
        
        // 根据可用宽度计算合适的缩放比例
        let newScale;
        if (availableWidth < 150) {
            newScale = 0.15;
        } else if (availableWidth < 200) {
            newScale = 0.2;
        } else if (availableWidth < 250) {
            newScale = 0.25;
        } else if (availableWidth < 300) {
            newScale = 0.3;
        } else {
            newScale = 0.35;
        }
        
        // 重新渲染所有缩略图
        this.regenerateThumbnails(newScale);
    }

    async regenerateThumbnails(scale) {
        const thumbnails = this.thumbnailContainer.querySelectorAll('.thumbnail-canvas');
        
        for (let i = 0; i < thumbnails.length; i++) {
            const canvas = thumbnails[i];
            const pageNumber = i + 1;
            
            try {
                const page = await this.pdfDoc.getPage(pageNumber);
                const viewport = page.getViewport({ scale: scale });
                
                // 获取设备像素密度
                const devicePixelRatio = window.devicePixelRatio || 1;
                
                // 设置canvas实际分辨率
                canvas.width = viewport.width * devicePixelRatio;
                canvas.height = viewport.height * devicePixelRatio;
                
                // 设置canvas显示尺寸
                canvas.style.width = viewport.width + 'px';
                canvas.style.height = viewport.height + 'px';
                
                const context = canvas.getContext('2d');
                context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
            } catch (error) {
                console.error(`重新生成第${pageNumber}页缩略图失败:`, error);
            }
        }
    }

    setupWindowResize() {
        // 监听窗口大小变化，自动调整PDF显示
        window.addEventListener('resize', () => {
            if (this.pdfDoc && this.pageNum) {
                // 延迟调整以避免过于频繁的重新渲染
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    this.adjustPDFScale();
                    this.renderPage(this.pageNum);
                }, 300);
            }
        });
    }

    adjustPDFScale() {
        if (!this.pdfDoc) return;
        
        const viewerContainer = this.pdfContainer;
        const availableWidth = viewerContainer.clientWidth - 80; // 减去边距
        
        // 验证容器尺寸是否有效
        if (!viewerContainer || availableWidth <= 0) {
            console.warn('⚠️ adjustPDFScale: 容器尺寸无效，跳过缩放调整');
            return;
        }
        
        // 获取PDF原始尺寸
        this.pdfDoc.getPage(this.pageNum).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            const pdfWidth = viewport.width;
            
            console.log(`🔍 adjustPDFScale: 容器宽度=${availableWidth}, PDF宽度=${pdfWidth}`);
            
            // 主要基于宽度来计算缩放比例，让PDF自然适应容器宽度
            let newScale = availableWidth / pdfWidth;
            console.log(`🔍 adjustPDFScale: 计算的缩放=${newScale.toFixed(3)}`);
            
            // 验证计算结果是否合理
            if (newScale <= 0 || !isFinite(newScale)) {
                console.warn('⚠️ adjustPDFScale: 计算出异常的缩放值，跳过调整');
                return;
            }
            
            // 限制缩放范围，但允许更大的范围
            newScale = Math.max(0.3, Math.min(3.0, newScale));
            console.log(`🔍 adjustPDFScale: 限制后的缩放=${newScale.toFixed(3)}, 当前缩放=${this.scale.toFixed(3)}`);
            
            // 只有当缩放变化较大时才更新
            if (Math.abs(this.scale - newScale) > 0.1) {
                console.log(`🎯 adjustPDFScale: 更新缩放从${this.scale.toFixed(3)}到${newScale.toFixed(3)}`);
                this.scale = newScale;
                this.updateZoomLevel();
                this.updateSliderPosition();
            } else {
                console.log('🔍 adjustPDFScale: 缩放变化太小，跳过更新');
            }
        }).catch(error => {
            console.error('调整PDF缩放失败:', error);
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            this.loadPDF(file);
        } else {
            alert('请选择一个PDF文件');
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        this.dropZone.classList.add('dragover');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.dropZone.classList.remove('dragover');
    }

    handleDrop(event) {
        event.preventDefault();
        this.dropZone.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                this.loadPDF(file);
            } else {
                alert('请拖拽一个PDF文件');
            }
        }
    }

    async loadPDF(file) {
        this.showLoading();
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            // 创建两个独立的ArrayBuffer副本，一个用于PDF.js，一个用于存储
            const pdfDataForPDFJS = arrayBuffer.slice();
            const pdfDataForStorage = arrayBuffer.slice();
            
            const pdf = await pdfjsLib.getDocument({ data: pdfDataForPDFJS }).promise;
            
            this.pdfDoc = pdf;
            this.pageCount = pdf.numPages;
            this.pageNum = 1;
            
            // 设置书籍信息用于记忆功能
            this.currentBookName = file.name;
            this.currentBookId = this.generateBookId(file.name, file.size);
            this.currentPDFData = pdfDataForStorage; // 保存PDF数据用于本地存储
            console.log(`📚 加载书籍: ${this.currentBookName} (ID: ${this.currentBookId})`);
            
            // 检查是否有阅读记录
            const savedProgress = this.loadReadingProgress(this.currentBookId);
            
            this.hideLoading();
            this.showPDFViewer();
            
            // 首次加载时自动调整缩放
            this.adjustPDFScale();
            this.updateZoomLevel(); // 显示当前缩放级别
            this.updateSliderPosition(); // 更新滑块位置
            
            // 如果有阅读记录，恢复到上次位置；否则从第1页开始
            if (savedProgress) {
                await this.restoreReadingPosition(savedProgress);
            } else {
                await this.renderPage(1);
            }
            
            this.generateThumbnails();
            this.updatePageInfo();
            this.updateNavigationButtons();
            
            // 延迟保存PDF到本地存储，确保所有处理完成
            setTimeout(() => {
                this.savePDFToLocal(file, this.currentPDFData);
            }, 500);
            
        } catch (error) {
            console.error('加载PDF失败:', error);
            this.hideLoading();
            alert('加载PDF失败，请检查文件格式');
        }
    }

    async renderPage(pageNumber, showTransition = false, scrollToTop = false) {
        if (!this.pdfDoc || pageNumber < 1 || pageNumber > this.pageCount) {
            return;
        }

        // 取消之前的渲染任务
        if (this.currentRenderTask) {
            this.currentRenderTask.cancel();
            this.currentRenderTask = null;
        }

        try {
            // 如果需要滚动到顶部，在渲染前立即设置
            if (scrollToTop && this.pdfContainer) {
                this.pdfContainer.scrollTop = 0;
            }
            
            // 添加淡出效果
            if (showTransition) {
                this.canvas.classList.add('fade-out');
                this.canvas.classList.remove('fade-in');
                
                // 等待淡出动画完成
                await new Promise(resolve => setTimeout(resolve, 60));
            }
            
            const page = await this.pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: this.scale });
            
            // 获取设备像素密度，确保高DPI显示器上的清晰度
            const devicePixelRatio = window.devicePixelRatio || 1;
            
            // 设置canvas实际分辨率（考虑设备像素密度）
            this.canvas.width = viewport.width * devicePixelRatio;
            this.canvas.height = viewport.height * devicePixelRatio;
            
            // 设置canvas显示尺寸（CSS尺寸）
            this.canvas.style.width = viewport.width + 'px';
            this.canvas.style.height = viewport.height + 'px';
            
            // 重置变换矩阵并缩放绘图上下文以匹配设备像素密度
            this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
            
            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };
            
            // 清空画布
            this.ctx.clearRect(0, 0, viewport.width, viewport.height);
            
            // 创建渲染任务并保存引用
            this.currentRenderTask = page.render(renderContext);
            await this.currentRenderTask.promise;
            this.currentRenderTask = null;
            this.pageNum = pageNumber;
            this.updatePageInfo();
            this.updateNavigationButtons();
            this.highlightCurrentThumbnail();
            this.updateGoToReadingPageButton(); // 更新回到朗读页面按钮状态
            
            // 保存阅读进度
            this.saveReadingProgress();
            
            // 添加淡入效果
            if (showTransition) {
                this.canvas.classList.remove('fade-out');
                this.canvas.classList.add('fade-in');
            }
            
        } catch (error) {
            // 忽略正常的渲染取消错误
            if (error.name === 'RenderingCancelledException') {
                console.log('🔄 渲染任务被取消 (正常操作)');
            } else {
                console.error('渲染页面失败:', error);
            }
            this.canvas.classList.remove('fade-out');
            this.canvas.classList.add('fade-in');
        }
    }

    async generateThumbnails() {
        this.thumbnailContainer.innerHTML = '';
        
        for (let i = 1; i <= this.pageCount; i++) {
            const thumbnailItem = document.createElement('div');
            thumbnailItem.className = 'thumbnail-item';
            
            const canvas = document.createElement('canvas');
            canvas.className = 'thumbnail-canvas';
            
            const info = document.createElement('div');
            info.className = 'thumbnail-info';
            info.textContent = `第 ${i} 页`;
            
            thumbnailItem.appendChild(canvas);
            thumbnailItem.appendChild(info);
            
            thumbnailItem.addEventListener('click', () => {
                this.renderPage(i, false, true);
            });
            
            this.thumbnailContainer.appendChild(thumbnailItem);
            
            // 渲染缩略图
            try {
                const page = await this.pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 0.2 });
                
                // 获取设备像素密度，确保缩略图清晰
                const devicePixelRatio = window.devicePixelRatio || 1;
                
                // 设置canvas实际分辨率
                canvas.width = viewport.width * devicePixelRatio;
                canvas.height = viewport.height * devicePixelRatio;
                
                // 设置canvas显示尺寸
                canvas.style.width = viewport.width + 'px';
                canvas.style.height = viewport.height + 'px';
                
                const context = canvas.getContext('2d');
                // 缩放上下文以匹配设备像素密度
                context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
            } catch (error) {
                console.error(`生成第${i}页缩略图失败:`, error);
            }
        }
    }

    highlightCurrentThumbnail() {
        const thumbnails = this.thumbnailContainer.querySelectorAll('.thumbnail-item');
        thumbnails.forEach((item, index) => {
            item.classList.toggle('active', index + 1 === this.pageNum);
        });
        
        // 滚动侧边栏到当前页面缩略图
        const currentThumbnail = thumbnails[this.pageNum - 1];
        if (currentThumbnail) {
            currentThumbnail.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    goToPreviousPage() {
        if (this.pageNum > 1) {
            this.stopReading(); // 手动翻页彻底停止朗读
            this.renderPage(this.pageNum - 1, true, true);
        }
    }

    goToNextPage() {
        if (this.pageNum < this.pageCount) {
            this.stopReading(); // 手动翻页彻底停止朗读
            this.renderPage(this.pageNum + 1, true, true);
        }
    }

    zoomIn() {
        this.scale = Math.min(this.scale + 0.25, 4.0);
        this.renderPage(this.pageNum);
        this.updateZoomLevel();
        this.updateSliderPosition();
    }

    zoomOut() {
        this.scale = Math.max(this.scale - 0.25, 0.3);
        this.renderPage(this.pageNum);
        this.updateZoomLevel();
        this.updateSliderPosition();
    }

    handleSliderZoom(event) {
        const sliderValue = parseInt(event.target.value);
        this.scale = sliderValue / 100;
        this.renderPage(this.pageNum);
        this.updateZoomLevel();
    }

    updateZoomLevel() {
        this.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    }

    updateSliderPosition() {
        this.zoomSlider.value = Math.round(this.scale * 100);
    }

    resetZoom() {
        this.scale = 1.5; // 重置到默认150%
        this.renderPage(this.pageNum);
        this.updateZoomLevel();
    }

    fitToWidth() {
        console.log('🔍 fitToWidth 函数被调用');
        
        if (!this.pdfDoc) {
            console.log('❌ PDF未加载，退出fitToWidth');
            return;
        }
        
        console.log(`📄 当前页码: ${this.pageNum}`);
        console.log(`📏 容器宽度: ${this.pdfContainer.clientWidth}px`);
        
        // 获取当前页面
        this.pdfDoc.getPage(this.pageNum).then(page => {
            console.log('✅ 成功获取PDF页面');
            
            const viewport = page.getViewport({ scale: 1.0 });
            console.log(`📖 页面原始宽度: ${viewport.width}px`);
            console.log(`📖 页面原始高度: ${viewport.height}px`);
            
            const availableWidth = this.pdfContainer.clientWidth - 80; // 减去边距
            console.log(`📏 可用宽度: ${availableWidth}px`);
            
            const newScale = availableWidth / viewport.width;
            console.log(`🔢 计算的缩放比例: ${newScale.toFixed(3)}`);
            
            // 限制缩放范围
            const oldScale = this.scale;
            this.scale = Math.max(0.3, Math.min(3.0, newScale));
            console.log(`🎯 旧缩放: ${oldScale.toFixed(3)}, 新缩放: ${this.scale.toFixed(3)}`);
            
            this.renderPage(this.pageNum);
            this.updateZoomLevel();
            this.updateSliderPosition();
            
            console.log(`📐 适应屏幕宽度完成: ${Math.round(this.scale * 100)}%`);
        }).catch(error => {
            console.error('❌ fitToWidth 错误:', error);
        });
    }

    handleScroll() {
        // 使用防抖机制，避免频繁保存
        if (this.scrollSaveTimeout) {
            clearTimeout(this.scrollSaveTimeout);
        }
        
        this.scrollSaveTimeout = setTimeout(() => {
            this.saveReadingProgress();
        }, 1000); // 1秒后保存滚动位置
    }

    async handleWheel(event) {
        // 如果按住Ctrl/Cmd键，则为缩放功能
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const zoomFactor = 0.1;
            const delta = event.deltaY;
            
            const oldScale = this.scale;
            
            if (delta < 0) {
                // 向上滚动，放大
                this.scale = Math.min(this.scale + zoomFactor, 4.0);
            } else {
                // 向下滚动，缩小
                this.scale = Math.max(this.scale - zoomFactor, 0.3);
            }
            
            // 验证缩放值是否合理
            if (this.scale <= 0 || !isFinite(this.scale)) {
                console.warn('⚠️ handleWheel: 检测到异常缩放值，恢复到安全值');
                this.scale = 1.0;
            }
            
            console.log(`🔍 handleWheel: 缩放从${oldScale.toFixed(3)}到${this.scale.toFixed(3)}`);
            
            this.renderPage(this.pageNum);
            this.updateZoomLevel();
            return;
        }
        
        // 检查容器的滚动状态
        const container = this.pdfContainer;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const delta = event.deltaY;
        
        // 检查是否在滚动边界
        const atTop = scrollTop <= 0;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px容错
        
        // 只有在边界时才考虑翻页
        if ((delta < 0 && atTop && this.pageNum > 1) || 
            (delta > 0 && atBottom && this.pageNum < this.pageCount)) {
            // 在边界且有可翻页时，阻止默认滚动并翻页
            event.preventDefault();
            
            // 累积滚动量进行翻页
            this.scrollAccumulator += delta;
            
            if (this.wheelTimeout) {
                clearTimeout(this.wheelTimeout);
            }
            
            if (Math.abs(this.scrollAccumulator) >= 50) { // 较小的阈值用于边界翻页
                if (this.scrollAccumulator > 0 && this.pageNum < this.pageCount) {
                    // 向下翻页，新页面从顶部开始
                    container.scrollTop = 0;
                    await this.renderPage(this.pageNum + 1, true, true);
                } else if (this.scrollAccumulator < 0 && this.pageNum > 1) {
                    // 向上翻页，先翻页再设置底部位置
                    await this.renderPage(this.pageNum - 1, true);
                    // 使用双重 requestAnimationFrame 确保页面完全渲染
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            container.scrollTop = container.scrollHeight - container.clientHeight;
                        });
                    });
                }
                this.scrollAccumulator = 0;
            }
            
            this.wheelTimeout = setTimeout(() => {
                this.scrollAccumulator = 0;
            }, 300);
        }
        // 否则允许正常的页面内滚动（不阻止默认行为）
    }


    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        this.sidebar.classList.toggle('collapsed', !this.sidebarOpen);
    }

    handleKeyPress(event) {
        if (!this.pdfDoc) return;
        
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.goToPreviousPage();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.goToNextPage();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.goToPreviousPage();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.goToNextPage();
                break;
            case '=':
            case '+':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.zoomIn();
                }
                break;
            case '-':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.zoomOut();
                }
                break;
            case '0':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.resetZoom();
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.toggleSidebar();
                break;
        }
    }

    updatePageInfo() {
        this.pageInfo.textContent = `第 ${this.pageNum} 页 / 共 ${this.pageCount} 页`;
        this.updateProgressBar();
    }

    updateProgressBar() {
        if (this.progressBar && this.pageCount > 0) {
            const progress = (this.pageNum / this.pageCount) * 100;
            this.progressBar.style.width = `${progress}%`;
        }
    }

    updateNavigationButtons() {
        this.prevPageBtn.disabled = this.pageNum <= 1;
        this.nextPageBtn.disabled = this.pageNum >= this.pageCount;
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    showPDFViewer() {
        this.dropZone.style.display = 'none';
        this.pdfViewer.style.display = 'flex';
    }

    goHome() {
        // 刷新当前页面
        location.reload();
    }
    
    toggleLanguage() {
        const isChecked = this.languageToggleBtn.checked;
        const newLanguage = isChecked ? 'en' : 'zh';
        const currentLanguage = this.languageToggleBtn.dataset.language;
        
        // 更新开关状态
        this.languageToggleBtn.dataset.language = newLanguage;
        this.languageSwitchContainer.dataset.active = newLanguage;
        
        console.log(`🌍 语言切换: ${currentLanguage} → ${newLanguage}`);
        
        // 如果正在朗读，停止当前朗读
        if (this.isReading) {
            console.log('🔄 语言切换时停止当前朗读');
            this.forceStopReading();
        }
    }

    initializeLanguageSwitch() {
        // 设置默认语言为英文
        this.languageToggleBtn.checked = true;
        this.languageToggleBtn.dataset.language = 'en';
        this.languageSwitchContainer.dataset.active = 'en';
        console.log('🌍 语言开关初始化: 默认英文');
    }

    // 阅读记忆功能相关方法
    generateBookId(fileName, fileSize) {
        // 基于文件名和大小生成唯一ID
        const hash = this.simpleHash(fileName + fileSize);
        return `book_${hash}`;
    }

    simpleHash(str) {
        // 简单的字符串hash函数
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    saveReadingProgress() {
        if (!this.readingMemoryEnabled || !this.currentBookId) return;
        
        const progress = {
            bookId: this.currentBookId,
            bookName: this.currentBookName,
            currentPage: this.pageNum,
            totalPages: this.pageCount,
            scrollPosition: this.pdfContainer.scrollTop,
            lastReadTime: new Date().toISOString(),
            scale: this.scale
        };
        
        try {
            const savedBooks = JSON.parse(localStorage.getItem('pdfReaderBooks') || '{}');
            savedBooks[this.currentBookId] = progress;
            localStorage.setItem('pdfReaderBooks', JSON.stringify(savedBooks));
            
            console.log(`📚 保存阅读进度: ${this.currentBookName} - 第${this.pageNum}页`);
        } catch (error) {
            console.error('❌ 保存阅读进度失败:', error);
        }
    }

    loadReadingProgress(bookId) {
        if (!this.readingMemoryEnabled || !bookId) return null;
        
        try {
            const savedBooks = JSON.parse(localStorage.getItem('pdfReaderBooks') || '{}');
            const progress = savedBooks[bookId];
            
            if (progress) {
                console.log(`📖 找到阅读记录: ${progress.bookName} - 第${progress.currentPage}页`);
                return progress;
            }
        } catch (error) {
            console.error('❌ 加载阅读进度失败:', error);
        }
        
        return null;
    }

    async restoreReadingPosition(progress) {
        if (!progress) return;
        
        try {
            console.log(`🔄 恢复阅读位置: 第${progress.currentPage}页`);
            
            // 确保页码在有效范围内
            const targetPage = Math.min(Math.max(1, progress.currentPage), this.pageCount);
            if (targetPage !== progress.currentPage) {
                console.log(`⚠️ 页码超出范围，调整为第${targetPage}页`);
            }
            
            // 恢复页码
            this.pageNum = targetPage;
            
            // 恢复缩放比例
            if (progress.scale) {
                this.scale = progress.scale;
                this.updateZoomLevel();
            }
            
            // 渲染页面
            await this.renderPage(this.pageNum);
            
            // 恢复滚动位置
            if (progress.scrollPosition) {
                setTimeout(() => {
                    this.pdfContainer.scrollTop = progress.scrollPosition;
                    console.log(`📍 恢复滚动位置: ${progress.scrollPosition}px`);
                }, 100);
            }
            
            // 显示恢复提示
            this.showRestoreNotification(progress);
            
        } catch (error) {
            console.error('❌ 恢复阅读位置失败:', error);
        }
    }

    showRestoreNotification(progress) {
        const notification = document.createElement('div');
        notification.className = 'restore-notification';
        notification.innerHTML = `
            <div class="restore-content">
                <span class="restore-icon">📖</span>
                <span class="restore-text">已恢复到《${progress.bookName}》第${progress.currentPage}页</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    getAllSavedBooks() {
        try {
            const savedBooks = JSON.parse(localStorage.getItem('pdfReaderBooks') || '{}');
            return Object.values(savedBooks).sort((a, b) => 
                new Date(b.lastReadTime) - new Date(a.lastReadTime)
            );
        } catch (error) {
            console.error('❌ 获取保存的书籍列表失败:', error);
            return [];
        }
    }

    // IndexedDB相关方法
    async initDB() {
        try {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);
                
                request.onerror = () => {
                    console.error('❌ IndexedDB打开失败:', request.error);
                    reject(request.error);
                };
                
                request.onsuccess = () => {
                    this.db = request.result;
                    console.log('✅ IndexedDB初始化成功');
                    resolve(this.db);
                    
                    // 初始化完成后检查是否有保存的PDF
                    this.checkForSavedPDF();
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // 创建PDF存储对象存储
                    if (!db.objectStoreNames.contains('pdfs')) {
                        const pdfStore = db.createObjectStore('pdfs', { keyPath: 'id' });
                        pdfStore.createIndex('name', 'name', { unique: false });
                        pdfStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                    }
                };
            });
        } catch (error) {
            console.error('❌ IndexedDB初始化失败:', error);
        }
    }

    async savePDFToLocal(file, pdfData) {
        if (!this.db) return;
        
        try {
            // 再次确保数据的完整性
            const dataToStore = pdfData instanceof ArrayBuffer ? pdfData : pdfData.slice();
            
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');
            
            const pdfRecord = {
                id: this.currentBookId,
                name: this.currentBookName,
                data: dataToStore,
                size: file.size,
                lastAccessed: new Date().toISOString(),
                mimeType: file.type
            };
            
            const request = store.put(pdfRecord);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log(`💾 PDF已保存到本地: ${this.currentBookName}`);
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('❌ PDF保存失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ PDF保存失败:', error);
        }
    }

    async loadPDFFromLocal(bookId) {
        if (!this.db) return null;
        
        try {
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.get(bookId);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {
                        console.log(`📖 从本地加载PDF: ${result.name}`);
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                };
                
                request.onerror = () => {
                    console.error('❌ PDF加载失败:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ PDF加载失败:', error);
            return null;
        }
    }

    async checkForSavedPDF() {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const index = store.index('lastAccessed');
            const request = index.openCursor(null, 'prev'); // 按最后访问时间倒序
            
            request.onsuccess = async (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const pdfRecord = cursor.value;
                    console.log(`🔍 发现保存的PDF: ${pdfRecord.name}`);
                    
                    try {
                        // 直接自动加载最后一次的PDF
                        await this.restoreLastPDF(pdfRecord.id);
                    } catch (error) {
                        console.error('❌ 自动加载PDF失败，显示拖拽界面:', error);
                        // 如果自动加载失败，确保显示拖拽界面
                        this.dropZone.style.display = 'flex';
                        this.pdfViewer.style.display = 'none';
                    }
                } else {
                    console.log('📝 没有找到保存的PDF，显示拖拽界面');
                    // 没有保存的PDF，显示拖拽界面
                    this.dropZone.style.display = 'flex';
                    this.pdfViewer.style.display = 'none';
                }
            };
        } catch (error) {
            console.error('❌ 检查保存的PDF失败:', error);
        }
    }

    showRestoreLastPDFOption(pdfRecord) {
        const notification = document.createElement('div');
        notification.className = 'restore-pdf-notification';
        notification.innerHTML = `
            <div class="restore-pdf-content">
                <span class="restore-pdf-icon">📚</span>
                <div class="restore-pdf-info">
                    <div class="restore-pdf-title">继续阅读上次的PDF</div>
                    <div class="restore-pdf-name">${pdfRecord.name}</div>
                </div>
                <div class="restore-pdf-actions">
                    <button class="restore-pdf-btn" onclick="pdfReader.restoreLastPDF('${pdfRecord.id}')">继续阅读</button>
                    <button class="restore-pdf-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 10秒后自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 10000);
    }

    async restoreLastPDF(bookId) {
        try {
            const pdfRecord = await this.loadPDFFromLocal(bookId);
            if (pdfRecord) {
                // 设置书籍信息
                this.currentBookId = pdfRecord.id;
                this.currentBookName = pdfRecord.name;
                this.currentPDFData = pdfRecord.data;
                
                // 加载PDF
                const pdf = await pdfjsLib.getDocument({ data: pdfRecord.data }).promise;
                this.pdfDoc = pdf;
                this.pageCount = pdf.numPages;
                this.pageNum = 1;
                
                // 获取阅读进度
                const savedProgress = this.loadReadingProgress(this.currentBookId);
                
                // 隐藏拖拽区域，显示PDF阅读器
                this.dropZone.style.display = 'none';
                this.pdfViewer.style.display = 'flex';
                
                this.adjustPDFScale();
                this.updateZoomLevel();
                this.updateSliderPosition();
                
                // 恢复阅读位置
                if (savedProgress) {
                    await this.restoreReadingPosition(savedProgress);
                } else {
                    await this.renderPage(1);
                }
                
                this.generateThumbnails();
                this.updatePageInfo();
                this.updateNavigationButtons();
                
                // 移除通知
                const notification = document.querySelector('.restore-pdf-notification');
                if (notification) {
                    notification.remove();
                }
                
                console.log(`✅ 成功恢复PDF: ${pdfRecord.name}`);
            }
        } catch (error) {
            console.error('❌ 恢复PDF失败:', error);
        }
    }

    resetToHomePage() {
        // 清空PDF相关数据
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageCount = 0;
        this.scale = 1.5;
        
        // 重置UI状态
        this.pdfViewer.style.display = 'none';
        this.dropZone.style.display = 'flex';
        this.dropZone.classList.remove('dragover');
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 清空缩略图
        this.thumbnailContainer.innerHTML = '';
        
        // 重置缩放显示
        this.zoomLevel.textContent = '150%';
        this.zoomSlider.value = 150;
        
        // 隐藏加载overlay
        this.hideLoading();
        
        // 重置文件输入
        this.fileInput.value = '';
        
        console.log('已返回首页');
    }

    showUploadModal() {
        this.uploadModal.style.display = 'flex';
        this.uploadFileInput.value = '';
        document.body.style.overflow = 'hidden';
    }

    hideUploadModal() {
        this.uploadModal.style.display = 'none';
        this.uploadDropZone.classList.remove('dragover');
        document.body.style.overflow = 'auto';
    }

    handleUploadFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            this.hideUploadModal();
            this.loadPDF(file);
        } else if (file) {
            alert('请选择一个PDF文件');
        }
    }

    handleUploadDragOver(event) {
        event.preventDefault();
        this.uploadDropZone.classList.add('dragover');
    }

    handleUploadDragLeave(event) {
        event.preventDefault();
        this.uploadDropZone.classList.remove('dragover');
    }

    handleUploadDrop(event) {
        event.preventDefault();
        this.uploadDropZone.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                this.hideUploadModal();
                this.loadPDF(file);
            } else {
                alert('请拖拽一个PDF文件');
            }
        }
    }

    handleHoverTrigger() {
        // 只有在未开始朗读时才允许悬停触发
        if (!this.isReading) {
            // 清除之前的定时器
            this.clearHoverTimeout();
            
            // 短暂延迟，避免意外触发
            this.hoverTimeout = setTimeout(() => {
                this.toggleReadAloud();
            }, 300); // 300ms 延迟
        } else {
            // 如果正在朗读（暂停或播放状态），不响应悬停
            console.log('🚫 朗读进行中，悬停触发已禁用，请点击按钮操作');
        }
    }

    clearHoverTimeout() {
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }
    }

    async toggleReadAloud() {
        if (this.isReading && !this.isPaused) {
            // 正在朗读 -> 暂停
            this.pauseReading();
        } else if (this.isReading && this.isPaused) {
            // 已暂停 -> 恢复
            this.resumeReading();
        } else {
            // 未开始 -> 开始朗读
            await this.startReading();
        }
    }

    pauseReading() {
        if (this.isReading && !this.isPaused) {
            console.log('⏸️ 执行暂停操作');
            
            // 暂停当前音频
            if (this.currentAudio && !this.currentAudio.paused) {
                this.currentAudio.pause();
                console.log('⏸️ 暂停当前音频');
            }
            
            // 暂停所有正在播放的音频
            this.allAudios.forEach((audio, index) => {
                if (audio && !audio.paused) {
                    audio.pause();
                    console.log(`⏸️ 暂停音频实例 ${index + 1}`);
                }
            });
            
            // 暂停预加载任务（清除定时器）
            this.preloadTimeouts.forEach(timeoutId => {
                clearTimeout(timeoutId);
            });
            this.preloadTimeouts = [];
            console.log('⏸️ 暂停预加载任务');
            
            this.isPaused = true;
            this.updateReadButton();
            console.log('⏸️ 朗读已暂停，所有音频和预加载任务已暂停');
        }
    }

    resumeReading() {
        if (this.isReading && this.isPaused) {
            console.log('▶️ 执行恢复操作');
            
            // 恢复当前音频播放
            if (this.currentAudio && this.currentAudio.paused) {
                this.currentAudio.play().then(() => {
                    console.log('▶️ 当前音频恢复播放');
                }).catch(error => {
                    console.error('▶️ 恢复播放失败:', error);
                });
            }
            
            // 恢复状态
            this.isPaused = false;
            this.updateReadButton();
            
            console.log('▶️ 朗读已恢复，继续播放当前段落');
        } else {
            console.log('⚠️ 无法恢复：当前状态不允许恢复操作');
            console.log(`⚠️ 调试信息 - isReading: ${this.isReading}, isPaused: ${this.isPaused}`);
        }
    }

    // 智能分段函数
    splitTextIntelligently(text, maxLength = null) {
        // 根据语言选择分段长度 - 合理的长度，既不会太短也不会太长
        const selectedLanguage = this.languageToggleBtn.dataset.language;
        if (maxLength === null) {
            maxLength = selectedLanguage === 'zh' ? 100 : 300; // 中文调整为100字符，英文保持300字符
        }
        const minLength = selectedLanguage === 'zh' ? 30 : 100; // 中文调整为30字符，英文最小100字符
        console.log(`🔍 分段参数 - 语言: ${selectedLanguage}, 最大长度: ${maxLength}, 最小长度: ${minLength}`);
        const segments = [];
        
        // 如果文本长度小于最大长度，直接返回整个文本
        if (text.length <= maxLength) {
            console.log(`📝 文本长度 ${text.length} 小于最大长度 ${maxLength}，不分段`);
            return [text.trim()];
        }
        
        // 智能分段：按句子边界分割，绝对不在句子中间切断
        const sentenceEnders = /([.!?。！？；;])\s*/g;
        const sentences = [];
        let lastIndex = 0;
        let match;
        
        // 提取完整的句子（包含标点符号）
        while ((match = sentenceEnders.exec(text)) !== null) {
            const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
            if (sentence) {
                sentences.push(sentence);
            }
            lastIndex = match.index + match[0].length;
        }
        
        // 添加最后一个句子（如果有的话）
        if (lastIndex < text.length) {
            const lastSentence = text.substring(lastIndex).trim();
            if (lastSentence) {
                sentences.push(lastSentence);
            }
        }
        
        // 如果没有找到句子边界，整个文本作为一个句子
        if (sentences.length === 0) {
            sentences.push(text.trim());
        }
        
        let currentSegment = '';
        
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            if (!sentence) continue;
            
            // 检查添加这个句子后是否超过最大长度
            const potentialSegment = currentSegment ? currentSegment + ' ' + sentence : sentence;
            
            if (potentialSegment.length <= maxLength) {
                // 不超过最大长度，添加到当前段落
                currentSegment = potentialSegment;
            } else {
                // 超过最大长度
                if (currentSegment) {
                    // 如果当前段落不为空，保存当前段落
                    segments.push(currentSegment);
                    currentSegment = sentence;
                } else {
                    // 单个句子就超过了最大长度，直接作为一个段落
                    // 不再强制分割，保持句子完整性
                    segments.push(sentence);
                    currentSegment = '';
                }
            }
        }
        
        // 添加最后一个段落
        if (currentSegment) {
            segments.push(currentSegment);
        }
        
        // 如果没有分段成功，直接返回原文本
        if (segments.length === 0 && text.trim().length > 0) {
            segments.push(text.trim());
        }
        
        // 🔧 优化段落长度：合并太短的段落，特别是第一段
        const optimizedSegments = [];
        
        for (let i = 0; i < segments.length; i++) {
            const currentSeg = segments[i];
            
            // 如果当前段落太短，尝试与下一段合并
            if (currentSeg.length < minLength && i + 1 < segments.length) {
                const nextSeg = segments[i + 1];
                const combinedSeg = currentSeg + ' ' + nextSeg;
                
                // 如果合并后不超过最大长度，就合并
                if (combinedSeg.length <= maxLength) {
                    optimizedSegments.push(combinedSeg);
                    i++; // 跳过下一段，因为已经合并了
                    console.log(`🔧 段落优化: 合并短段落 "${currentSeg.substring(0, 20)}..." + "${nextSeg.substring(0, 20)}..."`);
                } else {
                    // 合并后会超长，保持原样
                    optimizedSegments.push(currentSeg);
                }
            } else {
                // 段落长度合理，保持原样
                optimizedSegments.push(currentSeg);
            }
        }
        
        console.log(`📊 文本分段结果: ${optimizedSegments.length} 段（优化后）`);
        optimizedSegments.forEach((segment, index) => {
            console.log(`段 ${index + 1}: "${segment.substring(0, 80)}${segment.length > 80 ? '...' : ''}" (${segment.length} 字符)`);
        });
        
        return optimizedSegments;
    }
    

    async startReading() {
        if (!this.pdfDoc || this.isReading) return;
        
        console.log(`🔊 开始朗读第 ${this.pageNum} 页`);
        
        try {
            const page = await this.pdfDoc.getPage(this.pageNum);
            const textContent = await page.getTextContent();
            
            // 提取页面文本
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            console.log(`📝 页面文本提取完成，长度: ${pageText.length} 字符`);
            
            if (!pageText || pageText.length < 10) {
                console.log('⚠️ 当前页面没有足够的文本内容，尝试跳到下一页');
                
                // 如果是空白页且不是最后一页，自动跳到下一页继续朗读
                if (this.pageNum < this.pageCount) {
                    console.log('📖 跳过空白页，继续朗读下一页');
                    await this.autoGoToNextPageAndRead();
                    return;
                } else {
                    console.log('❌ 已是最后一页且没有文本内容');
                    alert('当前页面没有可朗读的文本内容');
                    return;
                }
            }
            
            // 智能分段
            const segments = this.splitTextIntelligently(pageText);
            console.log(`📄 文本已分为 ${segments.length} 段进行朗读`);
            
            this.isReading = true;
            this.readingPageNum = this.pageNum; // 记录开始朗读的页码
            this.currentSegmentIndex = 0;
            this.totalSegmentCount = segments.length;
            this.updateReadButton();
            this.updateStopButton();
            this.updateGoToReadingPageButton();
            
            // 显示朗读内容框并设置初始文本
            this.showReadingContentPanel(pageText, segments);
            
            // 逐段播放
            await this.playSegments(segments);
            
        } catch (error) {
            console.error('❌ 朗读失败:', error);
            alert('朗读功能出现错误，请重试');
            this.stopReading();
        }
    }

    async playSegments(segments) {
        let nextAudioPromise = null;
        let isPreloadingNext = false; // 防止重复预加载
        
        // 获取当前语言设置
        const selectedLanguage = this.languageToggleBtn.dataset.language;
        console.log(`🌍 当前语言: ${selectedLanguage}, 将使用对应的预加载策略`);
        
        for (let i = 0; i < segments.length; i++) {
            if (!this.isReading) break; // 检查是否被用户停止
            
            // 等待暂停状态结束
            while (this.isPaused && this.isReading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (!this.isReading) break; // 再次检查是否被停止
            
            console.log(`🎵 播放第 ${i+1}/${segments.length} 段`);
            
            // 更新朗读内容框显示当前段落
            this.updateReadingContentPanel(i, segments[i]);
            
            // 如果有预加载的音频，使用它；否则现场加载
            let audioPromise;
            if (nextAudioPromise) {
                console.log(`⚡ 使用预加载的第 ${i+1} 段音频`);
                audioPromise = nextAudioPromise;
                nextAudioPromise = null;
                isPreloadingNext = false;
            } else {
                console.log(`📡 现场加载第 ${i+1} 段音频`);
                // 只在第一段时显示加载指示器
                audioPromise = this.loadSegmentAudio(segments[i], 3, i === 0);
            }
            
            // 只在非第一段时才预加载下一段（第一段不预加载，让它专心播放）
            if (i > 0 && i + 1 < segments.length && this.isReading && !this.isPaused && !isPreloadingNext) {
                isPreloadingNext = true;
                
                // 非第一段的预加载延迟0.5秒
                const timeoutId = setTimeout(() => {
                    if (this.isReading && !this.isPaused && isPreloadingNext) {
                        nextAudioPromise = this.loadSegmentAudio(segments[i + 1]);
                        console.log(`⚡ 开始预加载第 ${i+2} 段`);
                    }
                }, 500); // 延迟0.5秒
                
                this.preloadTimeouts.push(timeoutId);
            } else if (i === 0 && i + 1 < segments.length && this.isReading && !this.isPaused) {
                // 第一段播放时立即预加载第二段（中文和英文都预加载）
                isPreloadingNext = true;
                console.log(`🎯 第一段播放开始，立即预加载第二段`);
                nextAudioPromise = this.loadSegmentAudio(segments[i + 1]);
            }
            
            try {
                // 等待当前段音频加载完成并播放
                const audioData = await audioPromise;
                await this.playAudioData(audioData);
                
                // 播放完成后再次检查状态，防止在播放过程中被暂停或停止
                if (!this.isReading) {
                    console.log('⚠️ 播放完成后检测到停止状态，退出播放循环');
                    break;
                }
                
                console.log(`✅ 第 ${i+1}/${segments.length} 段播放完成`);
                
                // 中文模式：在第一段播放完成后才开始预加载第二段
                if (i === 0 && i + 1 < segments.length && this.isReading && !this.isPaused && !isPreloadingNext && selectedLanguage === 'zh') {
                    isPreloadingNext = true;
                    console.log(`🎯 中文模式：第一段播放完成，现在开始预加载第二段`);
                    nextAudioPromise = this.loadSegmentAudio(segments[i + 1]);
                }
                
                // 段间短暂停顿（除了最后一段，且未暂停时）
                if (i < segments.length - 1 && this.isReading && !this.isPaused) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                // 中文模式：在第一段播放完成后才开始预加载第二段
                if (i === 0 && i + 1 < segments.length && this.isReading && !this.isPaused && !isPreloadingNext && selectedLanguage === 'zh') {
                    isPreloadingNext = true;
                    console.log(`🎯 中文模式：第一段播放完成，现在开始预加载第二段`);
                    nextAudioPromise = this.loadSegmentAudio(segments[i + 1]);
                }
            } catch (error) {
                console.error(`❌ 第 ${i+1} 段播放失败:`, error);
                
                // 检查是否是因为停止状态而导致的错误
                if (!this.isReading) {
                    console.log('🛑 检测到停止状态，退出播放循环');
                    break;
                }
                
                // 如果是停止错误，退出播放循环
                if (error.message && error.message.includes('朗读已停止')) {
                    console.log('🛑 检测到停止信号，退出播放循环');
                    break;
                }
                
                // 如果是前几段失败，尝试重启TTS服务
                if (i < 2) {
                    console.log('🔄 检测到早期段落失败，可能需要重启TTS服务');
                }
                
                // 继续播放下一段，不中断整个朗读
                continue;
            }
        }
        
        // 全部播放完成
        if (this.isReading) {
            console.log('✅ 所有段落播放完成');
            
            // 检查是否需要自动翻页
            if (this.autoNextPage && this.pageNum < this.pageCount) {
                console.log('📖 自动翻页到下一页并继续朗读');
                await this.autoGoToNextPageAndRead();
            } else {
                console.log('📚 已读完最后一页或自动翻页已关闭');
                this.stopReading();
            }
        }
    }

    async loadSegmentAudio(text, retryCount = 3, showLoadingIndicator = false) {
        // 在开始加载前检查是否已停止
        if (!this.isReading) {
            console.log(`🛑 [loadSegmentAudio] 朗读已停止，取消音频加载`);
            throw new Error('朗读已停止');
        }
        
        // 获取选择的语言
        const selectedLanguage = this.languageToggleBtn.dataset.language;
        
        // 生成唯一的请求ID用于调试
        const requestId = Math.random().toString(36).substring(2, 8);
        console.log(`🔍 [${requestId}] 开始加载音频 - 语言: ${selectedLanguage}, 文本: "${text.substring(0, 30)}..."`);
        
        // 只在需要时显示加载指示器（通常是第一段）
        if (showLoadingIndicator) {
            this.showTTSLoadingIndicator();
        }
        
        let ttsUrl;
        
        if (selectedLanguage === 'zh') {
            // 中文TTS - POST请求
            ttsUrl = 'https://ttszh.mattwu.cc/tts';
        } else {
            // 英文TTS - GET请求
            ttsUrl = `https://tts.mattwu.cc/api/tts?text=${encodeURIComponent(text)}&speaker_id=p335`;
        }
        
        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                // 在每次尝试前检查是否已停止
                if (!this.isReading) {
                    console.log(`🛑 [${requestId}] 朗读已停止，取消第 ${attempt} 次尝试`);
                    if (showLoadingIndicator) {
                        this.hideTTSLoadingIndicator();
                    }
                    throw new Error('朗读已停止');
                }
                
                console.log(`📡 [${requestId}] 正在生成${selectedLanguage === 'zh' ? '中文' : '英文'}语音 (尝试 ${attempt}/${retryCount})...`);
                
                let response;
                
                if (selectedLanguage === 'zh') {
                    // 中文TTS - POST请求
                    response = await fetch(ttsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            text: text
                        }),
                        signal: AbortSignal.timeout(300000) // 300秒(5分钟)超时
                    });
                } else {
                    // 英文TTS - GET请求
                    response = await fetch(ttsUrl, {
                        signal: AbortSignal.timeout(300000) // 300秒(5分钟)超时
                    });
                }
                
                if (!response.ok) {
                    throw new Error(`TTS API请求失败: ${response.status}`);
                }
                
                // 获取音频数据
                const audioBlob = await response.blob();
                console.log(`🎵 [${requestId}] ${selectedLanguage === 'zh' ? '中文' : '英文'}音频生成完成，大小: ${(audioBlob.size / 1024).toFixed(2)} KB`);
                
                // 在返回前最后检查一次是否已停止
                if (!this.isReading) {
                    console.log(`🛑 [${requestId}] 音频生成完成但朗读已停止，丢弃音频数据`);
                    if (showLoadingIndicator) {
                        this.hideTTSLoadingIndicator();
                    }
                    throw new Error('朗读已停止');
                }
                
                // 只在显示了加载指示器的情况下才隐藏
                if (showLoadingIndicator) {
                    this.hideTTSLoadingIndicator();
                }
                return audioBlob;
                
            } catch (error) {
                console.warn(`⚠️ [${requestId}] 第 ${attempt} 次尝试失败:`, error.message);
                
                // 检查是否是因为停止状态而导致的错误
                if (!this.isReading || (error.message && error.message.includes('朗读已停止'))) {
                    console.log(`🛑 [${requestId}] 检测到停止状态，取消重试`);
                    if (showLoadingIndicator) {
                        this.hideTTSLoadingIndicator();
                    }
                    throw new Error('朗读已停止');
                }
                
                if (attempt === retryCount) {
                    // 最后一次尝试失败时，只在显示了加载指示器的情况下才隐藏
                    if (showLoadingIndicator) {
                        this.hideTTSLoadingIndicator();
                    }
                    throw error;
                }
                
                // 重试前等待一段时间（同时检查是否被停止）
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                
                // 在重试前再次检查是否已停止
                if (!this.isReading) {
                    console.log(`🛑 [${requestId}] 重试等待期间检测到停止状态，取消重试`);
                    if (showLoadingIndicator) {
                        this.hideTTSLoadingIndicator();
                    }
                    throw new Error('朗读已停止');
                }
            }
        }
    }

    async playAudioData(audioBlob) {
        return new Promise((resolve, reject) => {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.removeAudioFromList(audio);
                // 播放结束时检查状态
                if (this.isReading) {
                    resolve();
                } else {
                    console.log('⚠️ 音频播放结束时检测到停止状态');
                    reject(new Error('朗读已停止'));
                }
            };
            
            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                this.removeAudioFromList(audio);
                reject(new Error('音频播放错误'));
            };
            
            // 存储当前音频引用用于停止控制
            this.currentAudio = audio;
            this.allAudios.push(audio); // 添加到所有音频列表
            
            // 播放前检查状态
            if (this.isReading) {
                audio.play().catch(reject);
            } else {
                URL.revokeObjectURL(audioUrl);
                this.removeAudioFromList(audio);
                reject(new Error('朗读已停止'));
            }
        });
    }

    removeAudioFromList(audio) {
        const index = this.allAudios.indexOf(audio);
        if (index > -1) {
            this.allAudios.splice(index, 1);
        }
    }


    // 测试方法：提取当前页面的文本内容
    async testTextExtraction() {
        if (!this.pdfDoc) {
            console.log('未加载PDF文档');
            return null;
        }
        
        try {
            const page = await this.pdfDoc.getPage(this.pageNum);
            const textContent = await page.getTextContent();
            
            // 提取页面文本
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            console.log('=== 文本提取测试结果 ===');
            console.log(`页面: ${this.pageNum}`);
            console.log(`文本项数量: ${textContent.items.length}`);
            console.log(`文本长度: ${pageText.length}`);
            console.log(`提取的文本: "${pageText}"`);
            
            // 返回提取的文本和元数据
            return {
                pageNumber: this.pageNum,
                itemCount: textContent.items.length,
                textLength: pageText.length,
                text: pageText,
                success: true
            };
            
        } catch (error) {
            console.error('文本提取失败:', error);
            return {
                pageNumber: this.pageNum,
                error: error.message,
                success: false
            };
        }
    }

    stopReading() {
        console.log('🛑 执行彻底停止朗读操作');
        
        // 立即设置停止状态，防止新的音频加载
        this.isReading = false;
        this.isPaused = false;
        
        // 停止所有音频实例
        this.allAudios.forEach((audio, index) => {
            if (audio) {
                console.log(`⏹️ 停止音频实例 ${index + 1}`);
                audio.pause();
                audio.currentTime = 0;
                audio.src = ''; // 清空音频源
                audio.load(); // 重载音频元素以确保彻底清理
            }
        });
        
        // 清空所有音频引用
        this.allAudios = [];
        this.currentAudio = null;
        
        // 清除所有预加载定时器
        this.preloadTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.preloadTimeouts = [];
        
        // 清除悬停定时器
        this.clearHoverTimeout();
        
        // 强制隐藏TTS加载指示器
        this.hideTTSLoadingIndicator();
        this.currentSegmentIndex = 0;
        this.totalSegmentCount = 0;
        this.readingPageNum = 1; // 重置朗读页码
        
        // 更新UI
        this.updateReadButton();
        this.updateStopButton();
        this.updateGoToReadingPageButton();
        this.hideReadingContentPanel();
        
        console.log('🔇 朗读功能已彻底停止，所有音频和定时器已清理，已恢复到平静状态');
    }

    async autoGoToNextPageAndRead() {
        try {
            // 翻到下一页
            if (this.pageNum < this.pageCount) {
                await this.renderPage(this.pageNum + 1, true, true);
                
                // 短暂延迟，确保页面渲染完成
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 继续朗读新页面
                if (this.isReading) {
                    this.readingPageNum = this.pageNum; // 更新朗读页码
                    this.updateGoToReadingPageButton();
                    await this.continueReadingCurrentPage();
                }
            } else {
                console.log('📚 已到达最后一页，停止朗读');
                this.stopReading();
            }
        } catch (error) {
            console.error('❌ 自动翻页失败:', error);
            this.stopReading();
        }
    }

    async continueReadingCurrentPage() {
        try {
            const page = await this.pdfDoc.getPage(this.pageNum);
            const textContent = await page.getTextContent();
            
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            console.log(`📄 第 ${this.pageNum} 页文本提取完成，长度: ${pageText.length} 字符`);
            
            if (pageText && pageText.length >= 10) {
                console.log(`📖 开始朗读第 ${this.pageNum} 页`);
                const segments = this.splitTextIntelligently(pageText);
                this.currentSegmentIndex = 0;
                this.totalSegmentCount = segments.length;
                // 更新朗读内容框显示新页面的文本
                this.showReadingContentPanel(pageText, segments);
                await this.playSegments(segments);
            } else {
                console.log('⚠️ 当前页面没有足够文本内容，跳过并继续下一页');
                
                // 如果是空白页且不是最后一页，递归继续下一页
                if (this.pageNum < this.pageCount && this.isReading) {
                    await this.autoGoToNextPageAndRead();
                } else {
                    console.log('📚 已到达最后一页或没有更多内容，停止朗读');
                    this.stopReading();
                }
            }
        } catch (error) {
            console.error('❌ 继续朗读失败:', error);
            this.stopReading();
        }
    }

    forceStopReading() {
        console.log('🛑 用户强制停止朗读 - 点击停止按钮');
        this.stopReading();
    }

    goToReadingPage() {
        if (this.isReading && this.readingPageNum !== this.pageNum) {
            console.log(`📖 跳转到朗读页面: 第 ${this.readingPageNum} 页`);
            this.renderPage(this.readingPageNum, true, true);
        }
    }

    updateReadButton() {
        if (this.isReading && this.isPaused) {
            this.readAloudBtn.innerHTML = '▶️ Play';
            this.readAloudBtn.title = '继续朗读';
            this.readAloudBtn.classList.add('reading');
            this.readAloudBtn.classList.add('paused');
        } else if (this.isReading) {
            this.readAloudBtn.innerHTML = '⏸️ Pause';
            this.readAloudBtn.title = '暂停朗读';
            this.readAloudBtn.classList.add('reading');
            this.readAloudBtn.classList.remove('paused');
        } else {
            this.readAloudBtn.innerHTML = '🔊 Read';
            this.readAloudBtn.title = '朗读当前页';
            this.readAloudBtn.classList.remove('reading', 'paused');
        }
    }

    updateStopButton() {
        if (this.isReading) {
            this.stopReadingBtn.classList.add('active');
            this.stopReadingBtn.title = '停止朗读';
        } else {
            this.stopReadingBtn.classList.remove('active');
            this.stopReadingBtn.title = '停止朗读';
        }
    }

    updateGoToReadingPageButton() {
        console.log(`🔍 updateGoToReadingPageButton - isReading: ${this.isReading}, readingPageNum: ${this.readingPageNum}, currentPageNum: ${this.pageNum}`);
        
        if (this.isReading) {
            this.goToReadingPageBtn.style.display = 'inline-block';
            this.goToReadingPageBtn.innerHTML = `📖 P${this.readingPageNum}`;
            this.goToReadingPageBtn.title = `回到朗读页面（第 ${this.readingPageNum} 页）`;
            console.log(`✅ 显示回到朗读页面按钮: P${this.readingPageNum}`);
            
            // 如果当前页面不是朗读页面，添加脉冲效果
            if (this.pageNum !== this.readingPageNum) {
                this.goToReadingPageBtn.classList.add('pulse');
                console.log(`💫 添加脉冲效果 - 当前页 ${this.pageNum} != 朗读页 ${this.readingPageNum}`);
            } else {
                this.goToReadingPageBtn.classList.remove('pulse');
                console.log(`📍 移除脉冲效果 - 在朗读页面`);
            }
        } else {
            this.goToReadingPageBtn.style.display = 'none';
            this.goToReadingPageBtn.classList.remove('pulse');
            console.log(`❌ 隐藏回到朗读页面按钮 - 未在朗读`);
        }
    }

    // 显示朗读内容框
    showReadingContentPanel(fullText, segments) {
        console.log('🔍 showReadingContentPanel 被调用');
        console.log('🔍 readingContentPanel 元素:', this.readingContentPanel);
        console.log('🔍 readingText 元素:', this.readingText);
        console.log('🔍 当前最小化状态:', this.isReadingPanelMinimized);
        
        if (!this.readingContentPanel) {
            console.error('❌ readingContentPanel 元素未找到');
            return;
        }
        
        // 更新文本内容和进度数据
        this.readingText.textContent = fullText;
        this.currentSegmentIndex = 0;
        this.totalSegmentCount = segments.length;
        
        // 更新进度信息
        this.updateReadingProgress();
        
        // 根据最小化状态决定显示方式
        if (this.isReadingPanelMinimized) {
            // 如果之前被最小化，显示浮标而不是完整面板
            this.showFloatingWidget();
            console.log('📋 朗读内容已更新，保持浮标显示');
        } else {
            // 正常显示完整面板
            this.readingContentPanel.style.display = 'block';
            console.log('📋 朗读内容框已显示, 文本长度:', fullText.length);
        }
    }

    // 更新朗读内容框当前段落
    updateReadingContentPanel(segmentIndex, currentSegmentText) {
        // 始终更新段落索引，即使面板隐藏（为了浮标能正确显示）
        this.currentSegmentIndex = segmentIndex;
        
        // 始终更新进度信息
        this.updateReadingProgress();
        
        // 如果面板或文本内容不存在，跳过文本高亮更新
        if (!this.readingContentPanel || !this.readingText) {
            return;
        }
        
        // 高亮当前段落
        const allText = this.readingText.textContent;
        const segmentStart = allText.indexOf(currentSegmentText);
        
        if (segmentStart !== -1) {
            const beforeText = allText.substring(0, segmentStart);
            const afterText = allText.substring(segmentStart + currentSegmentText.length);
            
            this.readingText.innerHTML = 
                `<span style="color: #888; font-size: 0.9em;">${beforeText}</span>` +
                `<span id="currentHighlight" style="background-color: #007bff; color: white; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 1.1em;">${currentSegmentText}</span>` +
                `<span style="color: #888; font-size: 0.9em;">${afterText}</span>`;
            
            // 只有当面板可见时才滚动到当前高亮段落
            if (this.readingContentPanel.style.display !== 'none') {
                this.scrollToCurrentSegment();
            }
        }
        
        // 更新进度
        this.updateReadingProgress();
        
        console.log(`📋 朗读内容框已更新到第 ${segmentIndex + 1} 段`);
    }
    
    // 自动滚动到当前段落
    scrollToCurrentSegment() {
        const highlightElement = document.getElementById('currentHighlight');
        if (highlightElement && this.readingText) {
            // 平滑滚动到当前高亮段落
            highlightElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
            
            // 添加一个简单的动画效果
            highlightElement.style.animation = 'pulse 0.5s ease-in-out';
            setTimeout(() => {
                if (highlightElement) {
                    highlightElement.style.animation = '';
                }
            }, 500);
        }
    }

    // 更新朗读进度
    updateReadingProgress() {
        if (!this.currentSegment || !this.totalSegments || !this.readingProgressFill) return;
        
        this.currentSegment.textContent = `段落 ${this.currentSegmentIndex + 1}`;
        this.totalSegments.textContent = `共 ${this.totalSegmentCount} 段`;
        
        const progress = this.totalSegmentCount > 0 ? 
            ((this.currentSegmentIndex + 1) / this.totalSegmentCount) * 100 : 0;
        this.readingProgressFill.style.width = `${progress}%`;
        
        // 同步浮标进度
        this.syncFloatingWidgetProgress();
    }

    // 隐藏朗读内容框
    hideReadingContentPanel() {
        if (this.readingContentPanel) {
            this.readingContentPanel.style.display = 'none';
            this.readingText.textContent = '';
            this.readingText.innerHTML = ''; // 也清理HTML内容
            this.currentSegmentIndex = 0;
            this.totalSegmentCount = 0;
            this.updateReadingProgress();
            // 重置位置
            this.readingContentPanel.style.transform = 'translate(-50%, -50%)';
            this.readingContentPanel.style.left = '50%';
            this.readingContentPanel.style.top = '50%';
            // 重置最小化状态
            this.isReadingPanelMinimized = false;
            console.log('📋 朗读内容框已隐藏并清理');
        }
        // 同时隐藏浮标
        this.hideFloatingWidget();
    }

    // 最小化朗读内容框到浮标
    minimizeReadingContentPanel() {
        if (this.readingContentPanel && this.readingContentPanel.style.display !== 'none') {
            // 隐藏朗读面板
            this.readingContentPanel.style.display = 'none';
            // 显示浮标
            this.showFloatingWidget();
            // 设置最小化状态
            this.isReadingPanelMinimized = true;
            console.log('📋 朗读内容框已最小化为浮标');
        }
    }

    // 展开朗读内容框
    expandReadingContentPanel() {
        if (this.readingFloatingWidget && this.readingFloatingWidget.style.display !== 'none') {
            // 隐藏浮标
            this.readingFloatingWidget.style.display = 'none';
            // 显示朗读面板
            this.readingContentPanel.style.display = 'block';
            // 取消最小化状态
            this.isReadingPanelMinimized = false;
            
            // 展开后滚动到当前高亮段落
            setTimeout(() => {
                this.scrollToCurrentSegment();
            }, 100); // 稍微延迟一下确保面板完全显示
            
            console.log('📋 朗读内容框已从浮标展开');
        }
    }

    // 显示浮标
    showFloatingWidget() {
        if (this.readingFloatingWidget) {
            this.readingFloatingWidget.style.display = 'block';
            // 同步进度信息
            this.syncFloatingWidgetProgress();
            console.log('📋 朗读浮标已显示');
        }
    }

    // 隐藏浮标
    hideFloatingWidget() {
        if (this.readingFloatingWidget) {
            this.readingFloatingWidget.style.display = 'none';
            console.log('📋 朗读浮标已隐藏');
        }
    }

    // 同步浮标进度信息
    syncFloatingWidgetProgress() {
        if (this.floatingCurrentSegment && this.floatingTotalSegments) {
            this.floatingCurrentSegment.textContent = this.currentSegment.textContent;
            this.floatingTotalSegments.textContent = this.totalSegments.textContent;
            console.log('📋 浮标进度已同步:', this.currentSegment.textContent, this.totalSegments.textContent);
        }
    }

    // 显示TTS加载指示器
    showTTSLoadingIndicator() {
        // 显示朗读面板中的加载指示器
        if (this.ttsLoadingIndicator) {
            this.ttsLoadingIndicator.style.display = 'flex';
        }
        
        // 更新浮标显示加载状态
        if (this.floatingWidgetIcon && this.floatingWidgetTitle && this.floatingWidgetProgress) {
            this.floatingWidgetIcon.textContent = '⏳';
            this.floatingWidgetTitle.textContent = '生成语音中...';
            this.floatingWidgetProgress.style.display = 'none';
            
            // 添加加载动画
            this.readingFloatingWidget.classList.add('floating-widget-loading');
        }
        
        console.log('🎵 TTS加载指示器已显示');
    }

    // 隐藏TTS加载指示器
    hideTTSLoadingIndicator() {
        // 隐藏朗读面板中的加载指示器
        if (this.ttsLoadingIndicator) {
            this.ttsLoadingIndicator.style.display = 'none';
        }
        
        // 恢复浮标正常状态
        if (this.floatingWidgetIcon && this.floatingWidgetTitle && this.floatingWidgetProgress) {
            this.floatingWidgetIcon.textContent = '🎧';
            this.floatingWidgetTitle.textContent = '正在朗读';
            this.floatingWidgetProgress.style.display = 'flex';
            
            // 移除加载动画
            this.readingFloatingWidget.classList.remove('floating-widget-loading');
        }
        
        console.log('🎵 TTS加载指示器已隐藏');
    }

    // 设置朗读内容框拖拽功能
    setupReadingPanelDrag() {
        if (!this.readingContentPanel) return;
        
        const header = this.readingContentPanel.querySelector('.reading-panel-header');
        if (!header) return;
        
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialX = 0;
        let initialY = 0;
        
        header.addEventListener('mousedown', (e) => {
            // 不拖拽关闭按钮
            if (e.target.classList.contains('close-reading-panel')) return;
            
            isDragging = true;
            header.classList.add('dragging');
            
            // 获取当前位置
            const rect = this.readingContentPanel.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            startX = e.clientX;
            startY = e.clientY;
            initialX = centerX;
            initialY = centerY;
            
            // 防止文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newX = initialX + deltaX;
            let newY = initialY + deltaY;
            
            // 限制在窗口范围内
            const panelWidth = this.readingContentPanel.offsetWidth;
            const panelHeight = this.readingContentPanel.offsetHeight;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            const minX = panelWidth / 2;
            const maxX = windowWidth - panelWidth / 2;
            const minY = panelHeight / 2;
            const maxY = windowHeight - panelHeight / 2;
            
            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));
            
            // 转换为相对于中心的偏移
            const offsetX = newX - windowWidth / 2;
            const offsetY = newY - windowHeight / 2;
            
            this.readingContentPanel.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
            
            e.preventDefault();
        });
        
        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            
            isDragging = false;
            header.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        });
        
        // 触摸设备支持
        header.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('close-reading-panel')) return;
            
            isDragging = true;
            header.classList.add('dragging');
            
            const touch = e.touches[0];
            const rect = this.readingContentPanel.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            startX = touch.clientX;
            startY = touch.clientY;
            initialX = centerX;
            initialY = centerY;
            
            e.preventDefault();
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            let newX = initialX + deltaX;
            let newY = initialY + deltaY;
            
            // 限制在窗口范围内
            const panelWidth = this.readingContentPanel.offsetWidth;
            const panelHeight = this.readingContentPanel.offsetHeight;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            const minX = panelWidth / 2;
            const maxX = windowWidth - panelWidth / 2;
            const minY = panelHeight / 2;
            const maxY = windowHeight - panelHeight / 2;
            
            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));
            
            // 转换为相对于中心的偏移
            const offsetX = newX - windowWidth / 2;
            const offsetY = newY - windowHeight / 2;
            
            this.readingContentPanel.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
            
            e.preventDefault();
        });
        
        document.addEventListener('touchend', () => {
            if (!isDragging) return;
            
            isDragging = false;
            header.classList.remove('dragging');
        });
    }

    // 初始化时间统计功能
    initializeTimeTracking() {
        // 从localStorage读取累积使用时间
        this.totalUsageTime = parseInt(localStorage.getItem('pdfReaderUsageTime') || '0');
        
        // 启动时间更新定时器
        this.startTimeTracking();
        
        // 页面关闭时保存使用时间
        window.addEventListener('beforeunload', () => {
            this.saveUsageTime();
        });
        
        // 页面隐藏时保存使用时间
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveUsageTime();
            } else {
                // 页面重新可见时重置开始时间
                this.appStartTime = Date.now();
            }
        });
        
        console.log('⏰ 时间统计功能已初始化');
    }

    // 开始时间统计
    startTimeTracking() {
        this.timeUpdateInterval = setInterval(() => {
            this.updateTimeDisplay();
        }, 1000);
    }

    // 更新时间显示
    updateTimeDisplay() {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('zh-CN', { hour12: false });
        
        // 计算当前会话使用时间
        const sessionTime = Date.now() - this.appStartTime;
        const totalTime = this.totalUsageTime + sessionTime;
        
        // 格式化使用时间
        const usageTimeStr = this.formatTime(totalTime);
        
        // 更新完整浮标
        this.localTimeDisplay.textContent = currentTime;
        this.usageTimeDisplay.textContent = usageTimeStr;
        
        // 更新最小化浮标
        this.miniLocalTime.textContent = currentTime.substring(0, 5); // 只显示时:分
        this.miniUsageTime.textContent = usageTimeStr;
    }

    // 格式化时间（毫秒转为时:分:秒）
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    // 保存使用时间到localStorage
    saveUsageTime() {
        const sessionTime = Date.now() - this.appStartTime;
        this.totalUsageTime += sessionTime;
        localStorage.setItem('pdfReaderUsageTime', this.totalUsageTime.toString());
        this.appStartTime = Date.now(); // 重置开始时间
    }

    // 最小化时间统计浮标
    minimizeTimeTrackingWidget() {
        this.timeTrackingWidget.style.display = 'none';
        this.timeTrackingMiniWidget.style.display = 'block';
        this.isTimeWidgetMinimized = true;
        console.log('⏰ 时间统计浮标已最小化');
    }

    // 展开时间统计浮标
    expandTimeTrackingWidget() {
        this.timeTrackingMiniWidget.style.display = 'none';
        this.timeTrackingWidget.style.display = 'block';
        this.isTimeWidgetMinimized = false;
        console.log('⏰ 时间统计浮标已展开');
    }

    // 重置使用时间计数器
    resetUsageTimeCounter() {
        this.totalUsageTime = 0;
        this.appStartTime = Date.now();
        localStorage.setItem('pdfReaderUsageTime', '0');
        this.updateTimeDisplay();
        console.log('⏰ 使用时间计数器已重置');
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const pdfReader = new PDFReader();
    
    // 将实例设置为全局变量，供HTML内联事件使用
    window.pdfReader = pdfReader;
    
    // 将测试方法暴露到全局作用域，便于在浏览器控制台测试
    window.testTextExtraction = () => pdfReader.testTextExtraction();
});