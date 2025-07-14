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
        
        this.initializeElements();
        this.setupEventListeners();
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

        // 侧边栏切换
        this.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // 滚轮翻页功能
        this.pdfContainer.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
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
            this.updateZoomLevel(); // 显示当前缩放级别
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
            
            // 设置canvas尺寸
            this.canvas.width = viewport.width;
            this.canvas.height = viewport.height;
            
            // 设置canvas显示尺寸，确保清晰度
            this.canvas.style.width = viewport.width + 'px';
            this.canvas.style.height = viewport.height + 'px';
            
            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };
            
            // 清空画布
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
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
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                const context = canvas.getContext('2d');
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
    }

    zoomOut() {
        this.scale = Math.max(this.scale - 0.25, 0.3);
        this.renderPage(this.pageNum);
        this.updateZoomLevel();
    }

    updateZoomLevel() {
        this.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
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
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new PDFReader();
});