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
        this.hoverTimeout = null; // 悬停防抖定时器
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupWindowResize();
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
        this.resizeHandle = document.getElementById('resizeHandle');
        this.zoomSlider = document.getElementById('zoomSlider');
        this.progressBar = document.getElementById('progressBar');
        this.homeBtn = document.getElementById('homeBtn');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.readAloudBtn = document.getElementById('readAloudBtn');
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
        
        // 首页按钮
        this.homeBtn.addEventListener('click', () => this.goHome());
        
        // 朗读按钮 - 悬停触发
        this.readAloudBtn.addEventListener('mouseenter', () => this.handleHoverTrigger());
        this.readAloudBtn.addEventListener('mouseleave', () => this.clearHoverTimeout());
        
        // 备用点击事件（防止悬停失效）
        this.readAloudBtn.addEventListener('click', () => this.toggleReadAloud());
        
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
        
        // 获取PDF原始尺寸
        this.pdfDoc.getPage(this.pageNum).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            const pdfWidth = viewport.width;
            
            // 主要基于宽度来计算缩放比例，让PDF自然适应容器宽度
            let newScale = availableWidth / pdfWidth;
            
            // 限制缩放范围，但允许更大的范围
            newScale = Math.max(0.3, Math.min(3.0, newScale));
            
            // 只有当缩放变化较大时才更新
            if (Math.abs(this.scale - newScale) > 0.1) {
                this.scale = newScale;
                this.updateZoomLevel();
                this.updateSliderPosition();
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
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            this.pdfDoc = pdf;
            this.pageCount = pdf.numPages;
            this.pageNum = 1;
            
            this.hideLoading();
            this.showPDFViewer();
            
            // 首次加载时自动调整缩放
            this.adjustPDFScale();
            this.updateZoomLevel(); // 显示当前缩放级别
            this.updateSliderPosition(); // 更新滑块位置
            await this.renderPage(1);
            this.generateThumbnails();
            this.updatePageInfo();
            this.updateNavigationButtons();
            
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
            
            await page.render(renderContext).promise;
            this.pageNum = pageNumber;
            this.updatePageInfo();
            this.updateNavigationButtons();
            this.highlightCurrentThumbnail();
            
            // 添加淡入效果
            if (showTransition) {
                this.canvas.classList.remove('fade-out');
                this.canvas.classList.add('fade-in');
            }
            
        } catch (error) {
            console.error('渲染页面失败:', error);
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
            this.renderPage(this.pageNum - 1, true, true);
        }
    }

    goToNextPage() {
        if (this.pageNum < this.pageCount) {
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

    async handleWheel(event) {
        // 如果按住Ctrl/Cmd键，则为缩放功能
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const zoomFactor = 0.1;
            const delta = event.deltaY;
            
            if (delta < 0) {
                // 向上滚动，放大
                this.scale = Math.min(this.scale + zoomFactor, 4.0);
            } else {
                // 向下滚动，缩小
                this.scale = Math.max(this.scale - zoomFactor, 0.3);
            }
            
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
        // 清除之前的定时器
        this.clearHoverTimeout();
        
        // 短暂延迟，避免意外触发
        this.hoverTimeout = setTimeout(() => {
            this.toggleReadAloud();
        }, 300); // 300ms 延迟
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
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.isPaused = true;
            this.updateReadButton();
            console.log('⏸️ 朗读已暂停');
        }
    }

    resumeReading() {
        if (this.currentAudio && this.currentAudio.paused) {
            this.currentAudio.play();
            this.isPaused = false;
            this.updateReadButton();
            console.log('▶️ 朗读已恢复');
        }
    }

    // 智能分段函数
    splitTextIntelligently(text, maxLength = 400) {
        const segments = [];
        let currentSegment = '';
        
        // 按句子分割（以句号、问号、感叹号为界）
        const sentences = text.split(/([.!?]+\s+)/);
        
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            
            if (currentSegment.length + sentence.length <= maxLength) {
                currentSegment += sentence;
            } else {
                if (currentSegment.trim() && currentSegment.trim().length > 20) {
                    segments.push(currentSegment.trim());
                }
                currentSegment = sentence;
            }
        }
        
        if (currentSegment.trim() && currentSegment.trim().length > 20) {
            segments.push(currentSegment.trim());
        }
        
        // 如果没有分段成功，按长度强制分段
        if (segments.length === 0 && text.length > maxLength) {
            for (let i = 0; i < text.length; i += maxLength) {
                const segment = text.substring(i, i + maxLength);
                if (segment.trim().length > 20) {
                    segments.push(segment.trim());
                }
            }
        }
        
        return segments.length > 0 ? segments : [text];
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
            
            if (!pageText) {
                console.log('❌ 当前页面没有可朗读的文本内容');
                alert('当前页面没有可朗读的文本内容');
                return;
            }
            
            // 智能分段
            const segments = this.splitTextIntelligently(pageText);
            console.log(`📄 文本已分为 ${segments.length} 段进行朗读`);
            
            this.isReading = true;
            this.updateReadButton();
            
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
        
        for (let i = 0; i < segments.length; i++) {
            if (!this.isReading) break; // 检查是否被用户停止
            
            // 等待暂停状态结束
            while (this.isPaused && this.isReading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (!this.isReading) break; // 再次检查是否被停止
            
            console.log(`🎵 播放第 ${i+1}/${segments.length} 段`);
            
            // 如果有预加载的音频，使用它；否则现场加载
            let audioPromise;
            if (nextAudioPromise) {
                audioPromise = nextAudioPromise;
                nextAudioPromise = null;
            } else {
                audioPromise = this.loadSegmentAudio(segments[i]);
            }
            
            // 开始预加载下一段（如果存在且未暂停）
            if (i + 1 < segments.length && this.isReading && !this.isPaused) {
                nextAudioPromise = this.loadSegmentAudio(segments[i + 1]);
                console.log(`⚡ 开始预加载第 ${i+2} 段`);
            }
            
            try {
                // 等待当前段音频加载完成并播放
                const audioData = await audioPromise;
                await this.playAudioData(audioData);
                
                // 段间短暂停顿（除了最后一段，且未暂停时）
                if (i < segments.length - 1 && this.isReading && !this.isPaused) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                console.error(`❌ 第 ${i+1} 段播放失败:`, error);
                // 继续播放下一段，不中断整个朗读
                continue;
            }
        }
        
        // 全部播放完成
        if (this.isReading) {
            console.log('✅ 所有段落播放完成');
            this.stopReading();
        }
    }

    async loadSegmentAudio(text) {
        // 调用外部TTS API加载音频数据
        const ttsUrl = `https://tts.mattwu.cc/api/tts?text=${encodeURIComponent(text)}&speaker_id=p335`;
        
        console.log('📡 正在生成语音...');
        const response = await fetch(ttsUrl, {
            signal: AbortSignal.timeout(30000) // 30秒超时
        });
        
        if (!response.ok) {
            throw new Error(`TTS API请求失败: ${response.status}`);
        }
        
        // 获取音频数据
        const audioBlob = await response.blob();
        console.log(`🎵 音频生成完成，大小: ${(audioBlob.size / 1024).toFixed(2)} KB`);
        
        return audioBlob;
    }

    async playAudioData(audioBlob) {
        return new Promise((resolve, reject) => {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                resolve();
            };
            
            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                reject(new Error('音频播放错误'));
            };
            
            // 存储当前音频引用用于停止控制
            this.currentAudio = audio;
            audio.play().catch(reject);
        });
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
        if (this.currentAudio) {
            console.log('⏹️ 停止音频播放');
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        this.isReading = false;
        this.isPaused = false;
        this.updateReadButton();
        console.log('🔇 朗读功能已停止');
    }

    updateReadButton() {
        if (this.isReading && this.isPaused) {
            this.readAloudBtn.innerHTML = '▶️';
            this.readAloudBtn.title = '继续朗读';
            this.readAloudBtn.classList.add('reading');
            this.readAloudBtn.classList.add('paused');
        } else if (this.isReading) {
            this.readAloudBtn.innerHTML = '⏸️';
            this.readAloudBtn.title = '暂停朗读';
            this.readAloudBtn.classList.add('reading');
            this.readAloudBtn.classList.remove('paused');
        } else {
            this.readAloudBtn.innerHTML = '🔊';
            this.readAloudBtn.title = '朗读当前页';
            this.readAloudBtn.classList.remove('reading', 'paused');
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const pdfReader = new PDFReader();
    
    // 将测试方法暴露到全局作用域，便于在浏览器控制台测试
    window.testTextExtraction = () => pdfReader.testTextExtraction();
    window.pdfReader = pdfReader;
});