// DOM 元素
const modelSelect = document.getElementById('model-select');
const apiUrlInput = document.getElementById('api-url');
const apiKeyInput = document.getElementById('api-key');
const genderSelect = document.getElementById('gender-select');
const aspectRatioSelect = document.getElementById('aspect-ratio');
const generateBtn = document.getElementById('generate-btn');
const cancelBtn = document.getElementById('cancel-btn');
const clearBtn = document.getElementById('clear-btn');
const loadingElement = document.getElementById('loading');
const resultImageElement = document.getElementById('result-image');
const generatedImage = document.getElementById('generated-image');
const downloadLink = document.getElementById('download-link');
const copyUrlBtn = document.getElementById('copy-url-btn');
const errorMessage = document.getElementById('error-message');
const historySelect = document.getElementById('history-select');
const resultPlaceholder = document.getElementById('result-placeholder');
const modal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');

// 用于取消请求的 AbortController
let abortController = null;
// 用于显示生成时间的计时器
let generationTimer = null;
// 历史记录数组
let history = [];

// 从 localStorage 加载历史记录
function loadHistoryFromStorage() {
    const saved = localStorage.getItem('ecommerce-history');
    if (saved) {
        try {
            history = JSON.parse(saved);
            updateHistorySelect();
        } catch (e) {
            console.error('加载历史记录失败:', e);
        }
    }
}

// 保存历史记录到 localStorage
function saveHistoryToStorage() {
    try {
        localStorage.setItem('ecommerce-history', JSON.stringify(history));
    } catch (e) {
        console.error('保存历史记录失败:', e);
    }
}

// 预配置的 API 信息（密钥存储在服务端 config.js，客户端不暴露）
const API_CONFIG = {
    'nano-banana-i2i': {
        type: 'image-to-image',
        model: 'nano-banana',
        multiImage: false
    },
    'doubao-4.0-i2i': {
        type: 'image-to-image',
        model: 'doubao-seedream-4-0-250828',
        multiImage: false
    }
};

// 服装图上身相关逻辑
let personFile = null;
let clothingFile = null;

// 初始化
function init() {
    setupEventListeners();
    updateModelOptions();
    loadHistoryFromStorage();
}

// 设置事件监听器
function setupEventListeners() {
    generateBtn.addEventListener('click', generateImage);
    cancelBtn.addEventListener('click', cancelGeneration);
    clearBtn.addEventListener('click', clearAll);
    copyUrlBtn.addEventListener('click', copyImageUrl);
    modelSelect.addEventListener('change', updateModelOptions);
    historySelect.addEventListener('change', loadHistoryItem);

    // 人物图片上传
    document.getElementById('person-upload-area').addEventListener('click', function() {
        document.getElementById('person-upload').click();
    });
    document.getElementById('person-upload').addEventListener('change', handlePersonUpload);

    // 服装图片上传
    document.getElementById('clothing-upload-area').addEventListener('click', function() {
        document.getElementById('clothing-upload').click();
    });
    document.getElementById('clothing-upload').addEventListener('change', handleClothingUpload);

    // 移除图片按钮（已移除，使用预览图片上的X号即可）
}

// 更新模型选项
function updateModelOptions() {
    const model = modelSelect.value;
    const config = API_CONFIG[model];

    if (config) {
        // API 密钥已移至服务端，不再显示在客户端

        // 服装图上身工具始终显示图片上传区域
        // 但根据模型不同，可能需要调整提示
        const personUploadArea = document.getElementById('person-upload-area');
        const clothingUploadArea = document.getElementById('clothing-upload-area');

        if (model === 'nano-banana-i2i') {
            // Nano-banana 图生图
            personUploadArea.querySelector('.upload-placeholder-text').textContent = '点击上传人物图片';
            clothingUploadArea.querySelector('.upload-placeholder-text').textContent = '点击上传服装图片';
        } else if (model === 'doubao-4.0-i2i') {
            // 即梦图生图
            personUploadArea.querySelector('.upload-placeholder-text').textContent = '点击上传人物图片';
            clothingUploadArea.querySelector('.upload-placeholder-text').textContent = '点击上传服装图片';
        }
    }
}

// 处理人物图片上传
function handlePersonUpload(event) {
    const file = event.target.files[0];
    if (file) {
        personFile = file;
        showPersonPreview(file);
    }
}

// 显示人物图片预览
function showPersonPreview(file) {
    const previewGrid = document.getElementById('person-preview-grid');
    const previewContainer = document.getElementById('person-preview-container');
    const personUploadArea = document.getElementById('person-upload-area');

    previewGrid.innerHTML = '';
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <img src="${e.target.result}" alt="人物图片">
            <button class="remove-single-btn" onclick="removePerson()">×</button>
        `;
        previewGrid.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
    previewContainer.style.display = 'block';
    personUploadArea.style.display = 'none'; // 隐藏上传占位符
}

// 移除人物图片
function removePerson() {
    personFile = null;
    document.getElementById('person-upload').value = '';
    document.getElementById('person-preview-grid').innerHTML = '';
    document.getElementById('person-preview-container').style.display = 'none';
    document.getElementById('person-upload-area').style.display = 'block'; // 显示上传占位符
}

// 处理服装图片上传
function handleClothingUpload(event) {
    const file = event.target.files[0];
    if (file) {
        clothingFile = file;
        showClothingPreview(file);
    }
}

// 显示服装图片预览
function showClothingPreview(file) {
    const previewGrid = document.getElementById('clothing-preview-grid');
    const previewContainer = document.getElementById('clothing-preview-container');
    const clothingUploadArea = document.getElementById('clothing-upload-area');

    previewGrid.innerHTML = '';
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <img src="${e.target.result}" alt="服装图片">
            <button class="remove-single-btn" onclick="removeClothing()">×</button>
        `;
        previewGrid.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
    previewContainer.style.display = 'block';
    clothingUploadArea.style.display = 'none'; // 隐藏上传占位符
}

// 移除服装图片
function removeClothing() {
    clothingFile = null;
    document.getElementById('clothing-upload').value = '';
    document.getElementById('clothing-preview-grid').innerHTML = '';
    document.getElementById('clothing-preview-container').style.display = 'none';
    document.getElementById('clothing-upload-area').style.display = 'block'; // 显示上传占位符
}

// 生成图片
async function generateImage() {
    const model = modelSelect.value;
    const aspectRatio = aspectRatioSelect.value;
    const config = API_CONFIG[model];

    // 根据画面比例计算对应的尺寸（2K分辨率）
    let size;
    switch (aspectRatio) {
        case '1:1':
            size = '2048x2048';  // 2K正方形
            break;
        case '16:9':
            size = '2560x1440';  // 2K横屏
            break;
        case '9:16':
            size = '1440x2560';  // 2K竖屏
            break;
        case '4:3':
            size = '1920x1440';  // 接近2K的传统比例
            break;
        default:
            size = '2048x2048';
    }

    // 验证输入
    if (!clothingFile) {
        showError('请上传服装图片');
        return;
    }

    // 积分检查
    if (window.KtoonPoints) {
        var loggedIn = localStorage.getItem('ktoon_logged_in');
        if (!loggedIn) {
            showError('请先登录');
            return;
        }
        var result = window.KtoonPoints.deduct('template');
        if (!result.ok) {
            showError('积分不足，生成图片需要 2 积分，当前剩余 ' + result.remaining + ' 积分');
            return;
        }
        if (window.parent && window.parent.refreshPointsDisplay) {
            window.parent.refreshPointsDisplay();
        }
    }

    // 生成提示词（四种状态）
    let prompt;
    const gender = genderSelect.value;

    if (personFile && clothingFile) {
        // 状态1：人物和服装都上传
        prompt = '让人物穿上图中衣服';
    } else if (!personFile && clothingFile) {
        // 状态2和3：只上传服装，根据性别选择提示词
        if (gender === 'female') {
            // 状态2：女性提示词
            prompt = '这张照片的场景是一间明亮的室内店铺：左侧立着衣架，女模特穿着图一同款衣服，旁边是穿着同款衣服和裤子的人体模特，背景是大幅落地窗，窗外是秋日交织的街景，人行车辆，树木，整体氛围既有室内的整洁温馨，又透着室外秋韵交融的清冷美感，光线透过窗户让空间显得通透柔和。模特右手摸一下人体模特的衣服，左手插口袋里。头部转向镜头，嘴角扬起柔和的笑意，眼神明亮看向镜头，整个动作舒展自然，既带着展示物品的轻巧姿态，又透出放松的从容感';
        } else {
            // 状态3：男性提示词
            prompt = '这张照片的场景是一间明亮的室内店铺：左侧立着衣架，挂着男装时尚衣物；男模特穿着图一同款衣服，旁边是穿着同款衣服和裤子的人体模特，背景是大幅落地窗，窗外是秋日交织的街景，人行车辆，树木，整体氛围既有室内的整洁温馨，又透着室外秋韵交融的清冷美感，光线透过窗户让空间显得通透柔和。模特右手摸一下人体模特的衣服，左手插口袋里。头部转向镜头，嘴角扬起柔和的笑意，眼神明亮看向镜头，整个动作舒展自然，既带着展示物品的轻巧姿态，又透出放松的从容感';
        }
    } else {
        // 状态4：没有上传图片
        showError('无法生成：请上传服装图片');
        return;
    }

    // 创建 AbortController 用于取消请求
    abortController = new AbortController();

    // 显示加载状态
    showLoading();
    hideError();
    hideResult();

    try {
        // 构建请求数据
        let requestData;

        if (model === 'nano-banana-i2i') {
            // Nano-banana 图生图 - 使用 /v1/images/edits 端点
            // 对于服装上身，发送人物图片作为主图，服装图片作为参考
            // 直接使用文件对象，不转换为 Base64
            if (personFile) {
                // 有人物图片：发送两张图片
                requestData = {
                    model: config.model,
                    prompt: prompt,
                    image: [personFile, clothingFile], // 发送两张图片的文件对象
                    response_format: "url",
                    size: size
                };
            } else {
                // 没有人物图片：只发送服装图片
                requestData = {
                    model: config.model,
                    prompt: prompt,
                    image: clothingFile, // 只发送服装图片的文件对象
                    response_format: "url",
                    size: size
                };
            }
        } else if (model === 'doubao-4.0-i2i') {
            // 读取图片并调整尺寸，传完整 data:image 格式
            const clothingBase64 = await readFileAsBase64(clothingFile, size);
            let personBase64 = null;

            if (personFile) {
                personBase64 = await readFileAsBase64(personFile, size);
            }

            if (personBase64) {
                requestData = {
                    model: config.model,
                    prompt: prompt,
                    image: [personBase64, clothingBase64],
                    response_format: "url",
                    size: size
                };
            } else {
                requestData = {
                    model: config.model,
                    prompt: prompt,
                    image: clothingBase64,
                    response_format: "url",
                    size: size
                };
            }
        }

        // 调试：显示请求数据
        console.log('请求模型:', requestData.model);
        console.log('请求提示词:', requestData.prompt);
        console.log('API 类型:', config.type);

        let response;

        // 根据模型和API端点选择不同的请求格式
        if (model === 'nano-banana-i2i') {
            // Nano-banana 图生图 - 使用 FormData 格式
            // 创建 FormData 对象
            const formData = new FormData();
            formData.append('model', requestData.model);
            formData.append('prompt', requestData.prompt);
            formData.append('response_format', requestData.response_format);

            // 添加图片 - 使用文件对象而不是 Base64
            if (Array.isArray(requestData.image)) {
                // 多图片请求 - 发送两张图片
                formData.append('image', requestData.image[0]); // 第一张图片（人物）
                formData.append('image', requestData.image[1]); // 第二张图片（服装）
            } else {
                // 单图片请求 - 只发送服装图片
                formData.append('image', requestData.image);
            }

            console.log('请求体 (FormData):', formData);

            // 通过统一代理（密钥在服务端）
            const fields = {
                model: requestData.model,
                prompt: requestData.prompt,
                response_format: requestData.response_format
            };
            let fileData = null;
            if (Array.isArray(requestData.image)) {
                // 多图片 - 转为 base64
                const files = [];
                for (const img of requestData.image) {
                    if (typeof img === 'string' && img.startsWith('data:')) {
                        files.push({ fieldName: 'image', name: 'image.png', contentType: 'image/png', base64: img });
                    }
                }
                // 服务端暂时只支持单文件，这里用多字段
                fileData = files[0];
            } else if (typeof requestData.image === 'string' && requestData.image.startsWith('data:')) {
                fileData = { fieldName: 'image', name: 'image.png', contentType: 'image/png', base64: requestData.image };
            }

            response = await fetch('/api-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'nano-banana-edit',
                    data: { fields, file: fileData },
                    format: 'formdata'
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
            }
        } else {
            // Doubao 图生图 - 使用 JSON 格式
            const proxyResponse = await fetch('/api-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    data: requestData
                }),
                signal: abortController.signal
            });

            if (!proxyResponse.ok) {
                const errorText = await proxyResponse.text();
                throw new Error(`代理请求失败: ${proxyResponse.status} - ${errorText}`);
            }

            response = proxyResponse;
        }

        const data = await response.json();

        // 调试：显示响应数据
        console.log('API 响应数据:', JSON.stringify(data, null, 2));

        // 处理响应
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

        displayResult(imageUrl);

        // 添加到历史记录
        addToHistory(imageUrl, model, size);

    } catch (error) {
        if (error.name === 'AbortError') {
            showError('请求已取消');
        } else {
            console.error('生成图片失败:', error);
            showError(`生成失败: ${error.message}`);
        }
        if (window.KtoonPoints) {
            KtoonPoints.refund('template');
            if (window.parent && window.parent.refreshPointsDisplay) window.parent.refreshPointsDisplay();
        }
    } finally {
        hideLoading();
        abortController = null;
    }
}

// 读取文件为 Base64，并可选地调整尺寸
function readFileAsBase64(file, targetSize = null) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (!targetSize) {
                resolve(reader.result);
                return;
            }

            // 创建图片对象
            const img = new Image();
            img.onload = () => {
                // 创建画布
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 解析目标尺寸 (例如 "1024x1024")
                const [width, height] = targetSize.split('x').map(Number);

                canvas.width = width;
                canvas.height = height;

                // 计算缩放比例，保持宽高比
                const scale = Math.min(width / img.width, height / img.height);
                const newWidth = img.width * scale;
                const newHeight = img.height * scale;

                // 居中绘制
                const x = (width - newWidth) / 2;
                const y = (height - newHeight) / 2;

                ctx.drawImage(img, x, y, newWidth, newHeight);

                // 转换为 Base64
                const resizedBase64 = canvas.toDataURL('image/jpeg', 0.9);
                resolve(resizedBase64);
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 取消生成
function cancelGeneration() {
    if (abortController) {
        abortController.abort();
    }
}

// 显示加载状态
function showLoading() {
    loadingElement.classList.remove('hidden');
    resultPlaceholder.classList.add('hidden');
    generateBtn.style.display = 'none';
    cancelBtn.style.display = 'inline-block';
    cancelBtn.disabled = false;

    // 添加计时器显示
    const loadingText = loadingElement.querySelector('p');
    let seconds = 0;
    loadingText.textContent = '正在生成图片...';

    generationTimer = setInterval(() => {
        seconds++;
        loadingText.textContent = `正在生成图片... (${seconds}s)`;
    }, 1000);
}

// 隐藏加载状态
function hideLoading() {
    loadingElement.classList.add('hidden');
    generateBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'none';

    // 清除计时器
    if (generationTimer) {
        clearInterval(generationTimer);
        generationTimer = null;
    }
}

// 显示结果
function displayResult(imageUrl) {
    const resultContainer = document.getElementById('result-container');
    generatedImage.src = imageUrl;
    downloadLink.href = imageUrl;
    resultContainer.classList.remove('hidden');
    resultImageElement.classList.remove('hidden');
    resultPlaceholder.classList.add('hidden');
}

// 添加到历史记录
function addToHistory(imageUrl, model, size) {
    const timestamp = new Date().toLocaleString('zh-CN');
    const historyItem = {
        id: Date.now(),
        imageUrl: imageUrl,
        model: model,
        size: size,
        timestamp: timestamp
    };

    history.unshift(historyItem);

    // 限制历史记录数量（最多20条）
    if (history.length > 20) {
        history = history.slice(0, 20);
    }

    updateHistorySelect();
    saveHistoryToStorage();
}

// 更新历史记录下拉框
function updateHistorySelect() {
    historySelect.innerHTML = '<option value="">-- 选择历史记录 --</option>';

    history.forEach((item, index) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${index + 1}. ${item.timestamp} - ${item.model}`;
        historySelect.appendChild(option);
    });
}

// 加载历史记录项
function loadHistoryItem() {
    const selectedId = historySelect.value;
    if (!selectedId) return;

    const item = history.find(h => h.id == selectedId);
    if (item) {
        generatedImage.src = item.imageUrl;
        downloadLink.href = item.imageUrl;
        resultImageElement.classList.remove('hidden');
        resultPlaceholder.classList.add('hidden');
    }
}

// 隐藏结果
function hideResult() {
    resultImageElement.classList.add('hidden');
    generatedImage.src = '';
    resultPlaceholder.classList.remove('hidden');
}

// 显示错误
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    resultPlaceholder.classList.add('hidden');
}

// 隐藏错误
function hideError() {
    errorMessage.classList.add('hidden');
    resultPlaceholder.classList.remove('hidden');
}

// 清空所有
function clearAll() {
    removePerson();
    removeClothing();
    hideResult();
    hideError();
    historySelect.value = '';
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

// 打开图片弹窗
function openModal() {
    if (generatedImage.src) {
        modalImage.src = generatedImage.src;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // 禁止背景滚动
    }
}

// 关闭图片弹窗
function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // 恢复背景滚动
}

// 点击弹窗背景关闭
modal.addEventListener('click', function(e) {
    if (e.target === modal) {
        closeModal();
    }
});

// ESC键关闭弹窗
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
    }
});

// 启动应用
init();
