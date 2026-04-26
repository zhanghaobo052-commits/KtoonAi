// DOM 元素
const modelSelect = document.getElementById('model-select');
const apiUrlInput = document.getElementById('api-url');
const apiKeyInput = document.getElementById('api-key');
const sizeSelect = document.getElementById('size');
const styleSelect = document.getElementById('style');
const aspectRatioSelect = document.getElementById('aspect-ratio');
const sizeGroup = document.getElementById('size-group');
const aspectRatioGroup = document.getElementById('aspect-ratio-group');
const promptTextarea = document.getElementById('prompt');
const generateBtn = document.getElementById('generate-btn');
const cancelBtn = document.getElementById('cancel-btn');
const clearBtn = document.getElementById('clear-btn');
const loadingElement = document.getElementById('loading');
const resultImageElement = document.getElementById('result-image');
const generatedImage = document.getElementById('generated-image');
const downloadLink = document.getElementById('download-link');
const copyUrlBtn = document.getElementById('copy-url-btn');
const errorMessage = document.getElementById('error-message');
const imageUploadGroup = document.getElementById('image-upload-group');
const uploadImageGroup = document.getElementById('upload-image-group');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const removeImageBtn = document.getElementById('remove-image-btn');

// 图片编辑弹窗相关元素
const editModal = document.getElementById('editModal');
const editModalClose = document.getElementById('editModalClose');
const editModalCancel = document.getElementById('editModalCancel');
const editImagePreview = document.getElementById('editImagePreview');
const editPromptInput = document.getElementById('editPromptInput');
const editGenerateBtn = document.getElementById('editGenerateBtn');
const uploadImageButton = document.getElementById('upload-image-btn');

// 编辑弹窗状态
let editImageFile = null;

// 历史记录相关元素
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// 用于取消请求的 AbortController
let abortController = null;
// 生成队列: [{ id, modelName, element, timer }]
let genQueue = [];
let genQueueId = 0;
// 历史记录数据
let generationHistory = [];

// 预配置的 API 信息（密钥存储在服务端 config.js，客户端不暴露）
const API_CONFIG = {
    'doubao-4.0-t2i': {
        type: 'text-to-image',
        model: 'doubao-seedream-4-0-250828',
        multiImage: false
    },
    'doubao-4.0-i2i': {
        type: 'image-to-image',
        model: 'doubao-seedream-4-0-250828',
        multiImage: false
    },
    'doubao-4.0-i2i-multi': {
        type: 'image-to-image',
        model: 'doubao-seedream-4-0-250828',
        multiImage: true
    },
    'nano-banana-t2i': {
        type: 'text-to-image',
        model: 'nano-banana',
        multiImage: false
    },
    'nano-banana-i2i': {
        type: 'image-to-image',
        model: 'nano-banana',
        multiImage: false
    },
    'flux-kontext-pro': {
        type: 'image-to-image',
        model: 'flux-kontext-pro',
        multiImage: false
    },
    'gpt-image2-t2i': {
        type: 'text-to-image',
        model: 'gpt-4o-image',
        multiImage: false
    },
    'gpt-image2-i2i': {
        type: 'image-to-image',
        model: 'gpt-4o-image',
        multiImage: false
    },
    'gpt-image-v2-t2i': {
        type: 'text-to-image',
        model: 'gpt-image-2',
        multiImage: false
    },
    'gpt-image-v2-i2i': {
        type: 'image-to-image',
        model: 'gpt-image-2',
        multiImage: false
    }
};

// 初始化
function init() {
    loadHistory();
    setupEventListeners();
    updateModelOptions();
    loadPromptFromURL();
}

// 从 URL 参数读取提示词
function loadPromptFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const prompt = urlParams.get('prompt');

    if (prompt) {
        // 解码 URL 参数
        const decodedPrompt = decodeURIComponent(prompt);

        // 填充到提示词文本框
        if (promptTextarea) {
            promptTextarea.value = decodedPrompt;

            // 滚动到提示词区域
            promptTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 高亮提示词区域短暂时间
            promptTextarea.style.border = '2px solid hsl(var(--primary))';
            setTimeout(() => {
                promptTextarea.style.border = '';
            }, 2000);
        }
    }
}

// 设置事件监听器
function setupEventListeners() {
    generateBtn.addEventListener('click', generateImage);
    cancelBtn.addEventListener('click', cancelGeneration);
    clearBtn.addEventListener('click', clearPrompt);
    downloadLink.addEventListener('click', downloadImage);
    document.getElementById('publish-btn').addEventListener('click', openPublishModal);
    document.getElementById('publishModalClose').addEventListener('click', closePublishModal);
    document.getElementById('publishModalCancel').addEventListener('click', closePublishModal);
    document.getElementById('publishModal').addEventListener('click', (e) => {
        if (e.target.id === 'publishModal') closePublishModal();
    });
    document.getElementById('publishModalSubmit').addEventListener('click', submitPublish);
    copyUrlBtn.addEventListener('click', copyImageUrl);
    modelSelect.addEventListener('change', updateModelOptions);
    imageUpload.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', removeImage);
    clearHistoryBtn.addEventListener('click', clearHistory);

    // 上传图片按钮 - 打开文件选择后上传到 IMGBB 并打开编辑弹窗
    if (uploadImageButton) {
        uploadImageButton.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    uploadImageButton.textContent = '上传中...';
                    uploadImageButton.disabled = true;
                    const reader = new FileReader();
                    const base64 = await new Promise((resolve, reject) => {
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    const resp = await fetch('/imgbb-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64 })
                    });
                    const result = await resp.json();
                    if (!result.success) throw new Error(result.error || '上传失败');
                    editImageFile = file;
                    openEditModal(result.data.url);
                } catch (err) {
                    alert('图片上传失败: ' + err.message);
                } finally {
                    uploadImageButton.textContent = '上传图片';
                    uploadImageButton.disabled = false;
                }
            });
            document.body.appendChild(input);
            input.click();
            input.addEventListener('change', () => {
                setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 1000);
            }, { once: true });
        });
    }

    // 编辑弹窗事件
    if (editModalClose) editModalClose.addEventListener('click', closeEditModal);
    if (editModalCancel) editModalCancel.addEventListener('click', closeEditModal);
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditModal();
        });
    }
    if (editGenerateBtn) editGenerateBtn.addEventListener('click', generateEditImage);

    // 上传区域点击事件
    const uploadArea = document.getElementById('image-upload-area');
    uploadArea.addEventListener('click', () => {
        // 创建一个新的文件输入元素来支持追加图片
        const newInput = document.createElement('input');
        newInput.type = 'file';
        newInput.accept = 'image/*';
        newInput.multiple = true;
        newInput.style.display = 'none';

        newInput.addEventListener('change', (e) => {
            const newFiles = e.target.files;
            if (newFiles.length > 0) {
                // 创建新的 DataTransfer 对象来合并现有文件和新文件
                const dataTransfer = new DataTransfer();

                // 添加现有文件
                const existingFiles = imageUpload.files;
                for (let i = 0; i < existingFiles.length; i++) {
                    dataTransfer.items.add(existingFiles[i]);
                }

                // 添加新文件
                for (let i = 0; i < newFiles.length; i++) {
                    dataTransfer.items.add(newFiles[i]);
                }

                // 更新文件输入元素
                imageUpload.files = dataTransfer.files;

                // 触发 change 事件处理
                const event = new Event('change', { bubbles: true });
                imageUpload.dispatchEvent(event);
            }

            // 清理临时元素
            document.body.removeChild(newInput);
        });

        document.body.appendChild(newInput);
        newInput.click();
    });

    // 拖拽事件
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'hsl(var(--primary))';
        uploadArea.style.background = 'hsl(var(--muted) / 0.5)';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'hsl(var(--border))';
        uploadArea.style.background = 'hsl(var(--muted) / 0.3)';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'hsl(var(--border))';
        uploadArea.style.background = 'hsl(var(--muted) / 0.3)';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            // 创建一个新的 DataTransfer 对象来设置文件
            const dataTransfer = new DataTransfer();
            for (let i = 0; i < files.length; i++) {
                dataTransfer.items.add(files[i]);
            }
            imageUpload.files = dataTransfer.files;

            // 触发 change 事件
            const event = new Event('change', { bubbles: true });
            imageUpload.dispatchEvent(event);
        }
    });
}

// 更新模型选项
function updateModelOptions() {
    const model = modelSelect.value;
    const config = API_CONFIG[model];

    if (config) {
        // API 密钥已移至服务端，不再显示在客户端

        // 显示/隐藏图片上传选项
        if (config.type === 'image-to-image') {
            imageUploadGroup.classList.add('show');
            if (uploadImageGroup) uploadImageGroup.style.display = 'block';
            // 图生图时隐藏比例和分辨率选项
            sizeGroup.style.display = 'none';
            aspectRatioGroup.style.display = 'none';

            // 更新上传区域提示
            const uploadPlaceholder = document.getElementById('upload-placeholder');
            const uploadArea = document.getElementById('image-upload-area');

            // 检查当前是否有图片
            const hasImages = imageUpload.files.length > 0;

            // 如果从多图切换到单图，且有多张图片，需要清空
            if (!config.multiImage && hasImages && imageUpload.files.length > 1) {
                // 清空图片
                imageUpload.value = '';
                document.getElementById('image-preview-grid').innerHTML = '';
                imagePreviewContainer.style.display = 'none';
                document.getElementById('image-count-info').style.display = 'none';

                // 重置上传区域样式
                uploadArea.style.borderColor = 'hsl(var(--border))';
                uploadArea.style.background = 'hsl(var(--muted) / 0.3)';

                // 显示单图模式的提示
                uploadPlaceholder.innerHTML = `
                    <div style="font-size: 40px; color: hsl(var(--muted-foreground)); margin-bottom: 10px;">+</div>
                    <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">点击或拖拽上传图片</div>
                    <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">上传单张图片进行图生图</div>
                `;
                return;
            }

            if (config.multiImage) {
                if (hasImages) {
                    const count = imageUpload.files.length;
                    uploadPlaceholder.innerHTML = `
                        <div style="font-size: 30px; color: hsl(var(--primary)); margin-bottom: 5px;">✓</div>
                        <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">已选择 ${count} 张图片</div>
                        <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">点击继续添加更多图片</div>
                    `;
                    uploadArea.style.borderColor = 'hsl(var(--primary))';
                    uploadArea.style.background = 'hsl(var(--muted) / 0.5)';
                } else {
                    uploadPlaceholder.innerHTML = `
                        <div style="font-size: 40px; color: hsl(var(--primary)); margin-bottom: 10px;">+</div>
                        <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">点击或拖拽上传多张图片</div>
                        <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">支持同时上传多张图片进行多图生图</div>
                    `;
                    uploadArea.style.borderColor = 'hsl(var(--border))';
                    uploadArea.style.background = 'hsl(var(--muted) / 0.3)';
                }
            } else {
                // 单图模式
                if (hasImages) {
                    // 只保留第一张图片
                    if (imageUpload.files.length > 1) {
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(imageUpload.files[0]);
                        imageUpload.files = dataTransfer.files;
                    }

                    uploadPlaceholder.innerHTML = `
                        <div style="font-size: 30px; color: hsl(var(--primary)); margin-bottom: 5px;">✓</div>
                        <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">已选择 1 张图片</div>
                        <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">移除图片后可重新选择</div>
                    `;
                    uploadArea.style.borderColor = 'hsl(var(--primary))';
                    uploadArea.style.background = 'hsl(var(--muted) / 0.5)';

                    // 更新预览只显示第一张
                    const previewGrid = document.getElementById('image-preview-grid');
                    previewGrid.innerHTML = '';
                    const file = imageUpload.files[0];
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const previewItem = document.createElement('div');
                        previewItem.className = 'preview-item';
                        previewItem.innerHTML = `
                            <img src="${e.target.result}" alt="预览图片 1">
                            <button class="remove-single-btn" data-index="0">×</button>
                        `;
                        previewItem.querySelector('.remove-single-btn').addEventListener('click', (e) => {
                            e.stopPropagation();
                            removeSingleImage(0);
                        });
                        previewGrid.appendChild(previewItem);
                    };
                    reader.readAsDataURL(file);
                } else {
                    uploadPlaceholder.innerHTML = `
                        <div class="upload-placeholder-icon">+</div>
                        <div class="upload-placeholder-text">点击或拖拽上传图片</div>
                        <div class="upload-placeholder-hint">上传单张图片进行图生图</div>
                    `;
                    uploadArea.style.borderColor = 'hsl(var(--border))';
                    uploadArea.style.backgroundColor = 'hsl(var(--muted) / 0.3)';
                }
            }
        } else {
            imageUploadGroup.classList.remove('show');
            if (uploadImageGroup) uploadImageGroup.style.display = 'none';
            imageUpload.value = ''; // 清空文件选择
            document.getElementById('image-preview-grid').innerHTML = ''; // 清空预览
            imagePreviewContainer.style.display = 'none'; // 隐藏预览容器
            document.getElementById('image-count-info').style.display = 'none'; // 隐藏计数信息
            // 文生图时显示比例和分辨率选项
            sizeGroup.style.display = 'block';
            aspectRatioGroup.style.display = 'block';
        }
    }
}

// 处理图片上传
function handleImageUpload(event) {
    const files = event.target.files;
    const uploadArea = document.getElementById('image-upload-area');
    const model = modelSelect.value;
    const config = API_CONFIG[model];

    if (files.length > 0) {
        const previewGrid = document.getElementById('image-preview-grid');
        const countInfo = document.getElementById('image-count-info');
        const countSpan = document.getElementById('image-count');

        previewGrid.innerHTML = '';
        countSpan.textContent = files.length;
        countInfo.style.display = 'block';
        imagePreviewContainer.style.display = 'block';

        // 更新上传区域样式和提示
        uploadArea.style.borderColor = 'hsl(var(--primary))';
        uploadArea.style.background = 'hsl(var(--muted) / 0.5)';

        // 根据模型类型和图片数量更新上传区域提示
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        if (config && config.multiImage) {
            // 多图生图模式
            if (files.length === 1) {
                uploadPlaceholder.innerHTML = `
                    <div style="font-size: 30px; color: hsl(var(--primary)); margin-bottom: 5px;">✓</div>
                    <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">已选择 1 张图片</div>
                    <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">点击继续添加更多图片</div>
                `;
            } else {
                uploadPlaceholder.innerHTML = `
                    <div style="font-size: 30px; color: hsl(var(--primary)); margin-bottom: 5px;">✓</div>
                    <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">已选择 ${files.length} 张图片</div>
                    <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">点击继续添加更多图片</div>
                `;
            }
        } else {
            // 单图生图模式
            uploadPlaceholder.innerHTML = `
                <div style="font-size: 30px; color: hsl(var(--primary)); margin-bottom: 5px;">✓</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">已选择 1 张图片</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">移除图片后可重新选择</div>
            `;
        }

        Array.from(files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" class="image-preview" alt="预览图片 ${index + 1}">
                    <button class="remove-single-btn" data-index="${index}">×</button>
                `;

                // 添加单张图片删除功能
                previewItem.querySelector('.remove-single-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeSingleImage(index);
                });

                previewGrid.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });
    } else {
        // 如果没有文件，重置上传区域样式和提示
        uploadArea.style.borderColor = 'hsl(var(--border))';
        uploadArea.style.background = 'hsl(var(--muted) / 0.3)';

        // 恢复原始提示
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        if (config && config.multiImage) {
            uploadPlaceholder.innerHTML = `
                <div style="font-size: 40px; color: hsl(var(--primary)); margin-bottom: 10px;">+</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">点击或拖拽上传多张图片</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">支持同时上传多张图片进行多图生图</div>
            `;
        } else {
            uploadPlaceholder.innerHTML = `
                <div style="font-size: 40px; color: hsl(var(--muted-foreground)); margin-bottom: 10px;">+</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">点击或拖拽上传图片</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">上传单张图片进行图生图</div>
            `;
        }
    }
}

// 移除单张图片
function removeSingleImage(index) {
    const dataTransfer = new DataTransfer();
    const files = imageUpload.files;

    for (let i = 0; i < files.length; i++) {
        if (i !== index) {
            dataTransfer.items.add(files[i]);
        }
    }

    imageUpload.files = dataTransfer.files;

    // 如果还有图片，更新显示；如果没有，隐藏容器
    if (imageUpload.files.length > 0) {
        handleImageUpload({ target: { files: imageUpload.files } });
    } else {
        imagePreviewContainer.style.display = 'none';
        document.getElementById('image-count-info').style.display = 'none';

        // 重置上传区域样式和提示
        const uploadArea = document.getElementById('image-upload-area');
        uploadArea.style.borderColor = 'hsl(var(--border))';
        uploadArea.style.background = 'hsl(var(--muted) / 0.3)';

        const model = modelSelect.value;
        const config = API_CONFIG[model];
        const uploadPlaceholder = document.getElementById('upload-placeholder');

        if (config && config.multiImage) {
            uploadPlaceholder.innerHTML = `
                <div style="font-size: 40px; color: hsl(var(--primary)); margin-bottom: 10px;">+</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">点击或拖拽上传多张图片</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">支持同时上传多张图片进行多图生图</div>
            `;
        } else {
            uploadPlaceholder.innerHTML = `
                <div style="font-size: 40px; color: hsl(var(--muted-foreground)); margin-bottom: 10px;">+</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 14px;">点击或拖拽上传图片</div>
                <div style="color: hsl(var(--muted-foreground)); font-size: 12px; margin-top: 5px;">上传单张图片进行图生图</div>
            `;
        }
    }
}

// 移除所有图片
function removeImage() {
    imageUpload.value = '';
    document.getElementById('image-preview-grid').innerHTML = '';
    imagePreviewContainer.style.display = 'none';
    document.getElementById('image-count-info').style.display = 'none';

    // 重置上传区域样式
    const uploadArea = document.getElementById('image-upload-area');
    uploadArea.style.borderColor = 'hsl(var(--border))';
    uploadArea.style.background = 'hsl(var(--muted) / 0.3)';
}

// 生成图片
async function generateImage() {
    const prompt = promptTextarea.value.trim();
    const model = modelSelect.value;
    const size = sizeSelect.value;
    const style = styleSelect.value;
    const aspectRatio = aspectRatioSelect.value;
    const config = API_CONFIG[model];

    // 验证模型配置
    if (!config) {
        showError('未找到模型配置，请重新选择模型');
        return;
    }

    // 验证输入
    if (!prompt) {
        showError('请输入提示词');
        return;
    }

    // 积分检查
    if (window.KtoonPoints) {
        var loggedIn = localStorage.getItem('ktoon_logged_in');
        if (!loggedIn) {
            showError('请先登录');
            return;
        }
        var result = window.KtoonPoints.deduct('image');
        if (!result.ok) {
            showError('积分不足，生成图片需要 1 积分，当前剩余 ' + result.remaining + ' 积分');
            return;
        }
        if (window.parent && window.parent.refreshPointsDisplay) {
            window.parent.refreshPointsDisplay();
        }
    }

    // 创建 AbortController 用于取消请求（每个请求独立）
    const reqAbortController = new AbortController();
    abortController = reqAbortController; // 保留全局引用供取消按钮使用

    // 显示加载状态（获取模型显示名）
    const modelDisplayName = modelSelect.options[modelSelect.selectedIndex].text;
    const taskId = showLoading(modelDisplayName);
    hideError();
    hideResult();

    try {
        // 构建增强的提示词
        let enhancedPrompt = prompt;

        // 添加风格修饰词
        const stylePrompts = {
            'cinematic': '电影感，电影大片，电影质感，专业摄影',
            'realistic': '写实，真实感，超写实，照片级真实',
            'anime': '动漫风格，二次元，日系动漫，动画风格',
            'oil-painting': '油画风格，油画质感，印象派',
            'watercolor': '水彩风格，水彩画，透明水彩',
            'cyberpunk': '赛博朋克，霓虹灯，未来科技，赛博',
            'fantasy': '奇幻风格，魔法，幻想，神秘',
            'minimalist': '极简主义，简约，留白，干净',
            'retro': '复古风格，怀旧，复古色调',
            'pixel-art': '像素艺术，像素风格，8位'
        };

        if (style && stylePrompts[style]) {
            enhancedPrompt += `, ${stylePrompts[style]}`;
        }


        // 构建请求数据
        let requestData;
        let imageUrl;

        if (config.type === 'image-to-image') {
            // 图生图逻辑
            const files = imageUpload.files;
            if (!files || files.length === 0) {
                showError('请选择上传图片');
                hideLoading(taskId);
                return;
            }

            // 读取所有图片并转换为 Base64
            const base64Images = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                const base64Image = await new Promise((resolve, reject) => {
                    reader.onload = () => {
                        // 保留完整的 data:image/xxx;base64, 前缀
                        const result = reader.result;
                        resolve(result);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                base64Images.push(base64Image);
            }

            if (model.startsWith('kling')) {
                // 可灵图生图 - 暂时只支持单张
                requestData = {
                    prompt: enhancedPrompt,
                    image: base64Images[0],
                    aspect_ratio: aspectRatio
                };
            } else {
                // 即梦图生图 - 传完整 data:image/...;base64, 格式
                requestData = {
                    model: config.model,
                    prompt: enhancedPrompt,
                    response_format: "url"
                };

                if (config.multiImage && base64Images.length > 1) {
                    requestData.image = base64Images;
                } else {
                    requestData.image = base64Images[0];
                }
            }
        } else {
            // 文生图逻辑
            if (model.startsWith('kling')) {
                // 可灵文生图
                requestData = {
                    prompt: enhancedPrompt,
                    aspect_ratio: aspectRatio
                };
            } else {
                requestData = {
                    model: config.model,
                    prompt: enhancedPrompt,
                    response_format: "url",
                    size: size,
                    aspect_ratio: aspectRatio
                };
            }
        }

        // 调试：显示请求数据
        console.log('请求模型:', requestData.model);
        console.log('请求提示词:', requestData.prompt);
        console.log('API 类型:', config.type);
        if (config.type === 'text-to-image') {
            console.log('请求尺寸:', size);
            console.log('请求比例:', aspectRatio);
        }

        let response;

        if (model.startsWith('doubao') || model === 'gpt-image2-t2i' || model === 'gpt-image-v2-t2i' || (model.startsWith('nano-banana') && config.type === 'text-to-image')) {
            // 即梦 API 和 Nano-banana 文生图 API - 使用 JSON 格式
            const jsonBody = {
                model: requestData.model,
                prompt: requestData.prompt,
                response_format: requestData.response_format
            };

            if (model.startsWith('gpt-image')) {
                jsonBody.n = 1;
            }

            if (config.type === 'text-to-image') {
                if (size && size !== 'auto') {
                    // gpt-image 需要 1k/2k/4k 格式
                    if (model.startsWith('gpt-image')) {
                        const sizeMap = { '1024x1024': '1k', '1536x1024': '2k', '1024x1536': '2k', '2K': '2k', '1280x720': '2k', '1920x1080': '2k' };
                        jsonBody.size = sizeMap[size] || '1k';
                    } else {
                        jsonBody.size = size;
                    }
                }
                if (aspectRatio) {
                    jsonBody.aspect_ratio = aspectRatio;
                }
            } else {
                // 图生图 - image 是 data:image 格式的 base64
                if (config.multiImage && Array.isArray(requestData.image) && requestData.image.length > 1) {
                    jsonBody.image = requestData.image;
                    jsonBody.sequential_image_generation = "disabled";
                } else {
                    jsonBody.image = requestData.image;
                }
            }

            console.log('请求体 (JSON):', jsonBody);

            // 通过统一代理（密钥在服务端）
            const proxyResponse = await fetch('/api-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    data: jsonBody
                }),
                signal: abortController.signal
            });

            if (!proxyResponse.ok) {
                const errorText = await proxyResponse.text();
                throw new Error(`代理请求失败: ${proxyResponse.status} - ${errorText}`);
            }

            response = proxyResponse;
        } else if (model === 'gpt-image2-i2i' || model === 'gpt-image-v2-i2i') {
            // GPT-Image-2 图生图 - 使用 /v1/images/generations 格式
            const files = imageUpload.files;
            if (!files || files.length === 0) {
                showError('请选择上传图片');
                hideLoading(taskId);
                return;
            }

            // 读取图片为 base64
            const file = files[0];
            const reader = new FileReader();
            const base64Image = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // 构建请求体，与文生图相同格式
            const i2iBody = {
                model: config.model,
                prompt: enhancedPrompt,
                image: [base64Image]
            };

            console.log('图生图请求:', { model: i2iBody.model, prompt: enhancedPrompt });

            const i2iResponse = await fetch('/api-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    data: i2iBody
                }),
                signal: abortController.signal
            });

            if (!i2iResponse.ok) {
                const errorText = await i2iResponse.text();
                throw new Error(`图生图请求失败: ${i2iResponse.status} - ${errorText}`);
            }

            const data = await i2iResponse.json();
            console.log('图生图响应:', JSON.stringify(data).substring(0, 500));

            // 从响应中提取图片 - 同文生图格式
            if (data.data && data.data.length > 0) {
                imageUrl = data.data[0].url || data.data[0].b64_json;
            } else {
                throw new Error('无法从响应中获取图片 URL');
            }

            // 跳过通用响应处理
            displayResult(imageUrl);
            addToHistory(imageUrl, enhancedPrompt, model, size);
            hideLoading(taskId);
            abortController = null;
            return;
        } else {
            // Flux Kontext Pro 和 Nano-banana 图生图 API - 使用 FormData 格式
            const fields = {
                model: requestData.model,
                prompt: requestData.prompt
            };

            // Flux Kontext Pro 支持 size 和 aspect_ratio 参数
            if (model === 'flux-kontext-pro') {
                if (size) fields.size = size;
                if (aspectRatio) fields.aspect_ratio = aspectRatio;
            }

            // 图生图模式 - 读取文件为 base64
            const file = imageUpload.files[0];
            let fileData = null;
            if (file) {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                fileData = {
                    fieldName: 'image',
                    name: file.name || 'image.png',
                    contentType: file.type || 'image/png',
                    base64: base64
                };
            }

            console.log('请求体 (FormData):', fields);

            // 通过统一代理（密钥在服务端）
            response = await fetch('/api-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    data: { fields, file: fileData },
                    format: 'formdata'
                }),
                signal: abortController.signal
            });
        }

        // 可灵 API 已经在轮询过程中处理了 imageUrl
        if (!model.startsWith('kling')) {
            if (!response.ok) {
                const responseText = await response.text();
                console.error('API 错误响应:', responseText);
                try {
                    const errorData = JSON.parse(responseText);
                    throw new Error(errorData.message || errorData.error || `HTTP 错误: ${response.status} - ${response.statusText}`);
                } catch (e) {
                    if (e.message.startsWith('HTTP 错误')) {
                        throw e;
                    }
                    throw new Error(`HTTP 错误: ${response.status} - ${response.statusText}\n响应内容: ${responseText}`);
                }
            }

            const data = await response.json();

            // 调试：显示响应数据
            console.log('API 响应数据:', JSON.stringify(data, null, 2));

            // 处理响应
            if (data.data && data.data[0] && data.data[0].url) {
                imageUrl = data.data[0].url;
            } else if (data.url) {
                imageUrl = data.url;
            } else if (data.data && Array.isArray(data.data) && data.data[0]) {
                imageUrl = data.data[0];
            } else {
                throw new Error('无法从响应中获取图片 URL');
            }
        }

        displayResult(imageUrl);

        // 添加到历史记录
        addToHistory(imageUrl, enhancedPrompt, model, size);

    } catch (error) {
        if (error.name === 'AbortError') {
            showError('请求已取消');
        } else {
            console.error('生成图片失败:', error);
            showError(`生成失败: ${error.message}`);
        }
        if (window.KtoonPoints) {
            KtoonPoints.refund('image');
            if (window.parent && window.parent.refreshPointsDisplay) window.parent.refreshPointsDisplay();
        }
    } finally {
        hideLoading(taskId);
        abortController = null;
    }
}

// 取消生成
function cancelGeneration() {
    if (abortController) {
        abortController.abort();
    }
}

// 添加一个生成任务到队列，返回任务 ID
function showLoading(modelName) {
    const id = ++genQueueId;
    const queueEl = document.getElementById('gen-queue');

    const item = document.createElement('div');
    item.className = 'gen-queue-item';
    item.id = 'gen-item-' + id;
    item.innerHTML = `<div class="spinner"></div><span class="gen-model">${modelName}</span><span class="gen-time">0s</span>`;
    queueEl.appendChild(item);

    const timeEl = item.querySelector('.gen-time');
    let seconds = 0;
    const timer = setInterval(() => {
        seconds++;
        timeEl.textContent = seconds + 's';
    }, 1000);

    genQueue.push({ id, modelName, element: item, timer });
    loadingElement.classList.remove('hidden');

    return id;
}

// 从队列移除指定任务
function hideLoading(id) {
    const idx = genQueue.findIndex(q => q.id === id);
    if (idx === -1) return;

    clearInterval(genQueue[idx].timer);
    genQueue[idx].element.remove();
    genQueue.splice(idx, 1);

    if (genQueue.length === 0) {
        loadingElement.classList.add('hidden');
    }
}

// 显示结果
function displayResult(imageUrl) {
    generatedImage.src = imageUrl;
    resultImageElement.classList.remove('hidden');
}

// 下载图片
async function downloadImage() {
    const imageUrl = generatedImage.src;
    if (!imageUrl) return;
    try {
        const resp = await fetch(imageUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ktoonai-' + Date.now() + '.png';
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        // fetch 失败（CORS）则通过服务器代理下载
        const a = document.createElement('a');
        a.href = '/proxy-download?url=' + encodeURIComponent(imageUrl);
        a.download = 'ktoonai-' + Date.now() + '.png';
        a.click();
    }
}

// 发布弹窗
function openPublishModal() {
    const imageUrl = generatedImage.src;
    if (!imageUrl) {
        showError('请先生成图片');
        return;
    }
    document.getElementById('publishModalImage').src = imageUrl;
    document.getElementById('publishModalTitle').value = '';
    document.getElementById('publishModalPrompt').textContent = promptTextarea.value.trim();
    document.getElementById('publishModal').classList.add('active');
}

function closePublishModal() {
    document.getElementById('publishModal').classList.remove('active');
}

function submitPublish() {
    const title = document.getElementById('publishModalTitle').value.trim();
    if (!title) {
        document.getElementById('publishModalTitle').style.borderColor = 'hsl(var(--destructive))';
        setTimeout(() => {
            document.getElementById('publishModalTitle').style.borderColor = '';
        }, 2000);
        return;
    }
    const imageUrl = generatedImage.src;
    const prompt = promptTextarea.value.trim();
    const loggedIn = localStorage.getItem('ktoon_logged_in') || '匿名用户';
    // Get avatar
    let avatar = '';
    if (loggedIn === '情绪过度老师') {
        avatar = 'https://ktoonai-1425689077.cos.ap-beijing.myqcloud.com/主用户/主用户头像.png';
    } else {
        const users = JSON.parse(localStorage.getItem('ktoon_users') || '[]');
        const u = users.find(function(u) { return u.username === loggedIn; });
        if (u && u.avatar) avatar = u.avatar;
    }
    // Save published work
    const works = JSON.parse(localStorage.getItem('ktoon_published_works') || '[]');
    works.unshift({
        id: Date.now(),
        title: title,
        image: imageUrl,
        prompt: prompt,
        username: loggedIn,
        avatar: avatar,
        timestamp: Date.now()
    });
    localStorage.setItem('ktoon_published_works', JSON.stringify(works));
    closePublishModal();
    if (typeof showToast === 'function') {
        showToast('发布成功！', 'success');
    } else {
        alert('发布成功！');
    }
}

// 图片编辑弹窗
function openEditModal(imageUrl) {
    editImagePreview.innerHTML = `<img src="${imageUrl}" alt="预览图片">`;
    editPromptInput.value = '';
    editModal.classList.add('active');
}

function closeEditModal() {
    editModal.classList.remove('active');
    editImageFile = null;
    editImagePreview.innerHTML = '<span style="color: hsl(var(--muted-foreground)); font-size: 13px;">暂无图片</span>';
}

async function generateEditImage() {
    if (!editImageFile) { alert('请先上传图片'); return; }
    const prompt = editPromptInput.value.trim();
    if (!prompt) {
        editPromptInput.style.borderColor = 'hsl(var(--destructive))';
        setTimeout(() => { editPromptInput.style.borderColor = ''; }, 2000);
        return;
    }

    editGenerateBtn.textContent = '生成中...';
    editGenerateBtn.disabled = true;

    try {
        // 将 File 转为 base64
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(editImageFile);
        });

        // 通过统一代理发送请求（密钥在服务端）
        const resp = await fetch('/api-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'nano-banana-edit',
                data: {
                    fields: { model: 'nano-banana', prompt: prompt },
                    file: { fieldName: 'image', name: 'image.png', contentType: 'image/png', base64: base64 }
                },
                format: 'formdata'
            })
        });

        if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(`请求失败: ${resp.status} - ${errorText}`);
        }

        const data = await resp.json();
        console.log('编辑响应:', JSON.stringify(data).substring(0, 500));

        let imageUrl;
        if (data.data && data.data[0] && data.data[0].url) {
            imageUrl = data.data[0].url;
        } else if (data.url) {
            imageUrl = data.url;
        } else if (data.data && Array.isArray(data.data) && data.data[0]) {
            imageUrl = data.data[0];
        } else {
            throw new Error('无法从响应中获取图片 URL');
        }

        // 显示结果
        generatedImage.src = imageUrl;
        resultImageElement.classList.remove('hidden');
        addToHistory(imageUrl, prompt, 'nano-banana-i2i', '');
        closeEditModal();

    } catch (err) {
        console.error('编辑失败:', err);
        alert('生成失败: ' + err.message);
    } finally {
        editGenerateBtn.textContent = '生成';
        editGenerateBtn.disabled = false;
    }
}

// 隐藏结果
function hideResult() {
    resultImageElement.classList.add('hidden');
    generatedImage.src = '';
}

// 显示错误
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

// 隐藏错误
function hideError() {
    errorMessage.classList.add('hidden');
}

// 清空提示词
function clearPrompt() {
    promptTextarea.value = '';
    // 同时清空图片预览
    removeImage();
}

// 复制图片 URL
async function copyImageUrl() {
    const imageUrl = generatedImage.src;
    if (!imageUrl) {
        showError('没有可复制的 URL');
        return;
    }

    try {
        await navigator.clipboard.writeText(imageUrl);
        const originalText = copyUrlBtn.textContent;
        copyUrlBtn.textContent = '已复制!';
        setTimeout(() => {
            copyUrlBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        showError('复制失败，请手动复制');
    }
}

// 历史记录功能

// 加载历史记录
function loadHistory() {
    const saved = localStorage.getItem('aiImageHistory');
    if (saved) {
        try {
            generationHistory = JSON.parse(saved);
            renderHistory();
        } catch (e) {
            console.error('加载历史记录失败:', e);
            generationHistory = [];
        }
    }
}

// 保存历史记录
function saveHistory() {
    localStorage.setItem('aiImageHistory', JSON.stringify(generationHistory));
}

// 添加到历史记录
function addToHistory(imageUrl, prompt, model, size) {
    const historyItem = {
        id: Date.now(),
        imageUrl: imageUrl,
        prompt: prompt,
        model: model,
        size: size,
        timestamp: new Date().toISOString()
    };

    // 添加到数组开头
    generationHistory.unshift(historyItem);

    // 限制历史记录数量（最多50条）
    if (generationHistory.length > 50) {
        generationHistory = generationHistory.slice(0, 50);
    }

    saveHistory();
    renderHistory();
}

// 渲染历史记录
function renderHistory() {
    if (generationHistory.length === 0) {
        historySection.style.display = 'none';
        return;
    }

    historySection.style.display = 'block';
    historyList.innerHTML = '';

    generationHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <img src="${item.imageUrl}" alt="${item.prompt}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22hsl(230, 15%25, 18%25)%22/><text x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22hsl(220, 10%25, 55%25)%22>图片加载失败</text></svg>'">
            <div class="history-item-info" title="${item.prompt}">${item.prompt}</div>
            <div class="history-item-time">${formatTime(item.timestamp)}</div>
            <button class="history-item-delete" data-id="${item.id}">×</button>
        `;

        // 点击图片加载到生成区域
        historyItem.querySelector('img').addEventListener('click', () => {
            loadHistoryItem(item);
        });

        // 点击删除按钮
        historyItem.querySelector('.history-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteHistoryItem(item.id);
        });

        historyList.appendChild(historyItem);
    });
}

// 加载历史记录项
function loadHistoryItem(item) {
    // 设置提示词
    promptTextarea.value = item.prompt;

    // 设置模型（如果模型在当前选项中）
    const modelOptions = Array.from(modelSelect.options).map(opt => opt.value);
    if (modelOptions.includes(item.model)) {
        modelSelect.value = item.model;
        updateModelOptions();
    }

    // 显示图片
    generatedImage.src = item.imageUrl;
    downloadLink.href = item.imageUrl;
    resultImageElement.classList.remove('hidden');

    // 滚动到结果区域
    resultImageElement.scrollIntoView({ behavior: 'smooth' });
}

// 删除历史记录项
function deleteHistoryItem(id) {
    generationHistory = generationHistory.filter(item => item.id !== id);
    saveHistory();
    renderHistory();
}

// 清空历史记录
function clearHistory() {
    if (confirm('确定要清空所有历史记录吗？')) {
        generationHistory = [];
        saveHistory();
        renderHistory();
    }
}

// 格式化时间
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 如果是今天
    if (diff < 86400000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    // 如果是昨天
    if (diff < 172800000) {
        return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    // 其他情况显示日期
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// 启动应用
init();
