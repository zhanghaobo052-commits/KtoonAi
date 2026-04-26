// DOM 元素
const modelSelect = document.getElementById('model-select');
const apiUrlInput = document.getElementById('api-url');
const apiKeyInput = document.getElementById('api-key');
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
const promptInput = document.getElementById('prompt-input');
const aiPolishBtn = document.getElementById('ai-polish-btn');

// 用于取消请求的 AbortController
let abortController = null;
// 用于显示生成时间的计时器
let generationTimer = null;
// 历史记录数组
let history = [];

// 从 localStorage 加载历史记录
function loadHistoryFromStorage() {
    const saved = localStorage.getItem('ecommerce-product-history');
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
        localStorage.setItem('ecommerce-product-history', JSON.stringify(history));
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

// 商品图相关逻辑
let productFile = null;

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
    aiPolishBtn.addEventListener('click', aiPolishPrompt);

    // 商品图片上传
    document.getElementById('product-upload-area').addEventListener('click', function() {
        document.getElementById('product-upload').click();
    });
    document.getElementById('product-upload').addEventListener('change', handleProductUpload);
}

// 更新模型选项
function updateModelOptions() {
    const model = modelSelect.value;
    const config = API_CONFIG[model];

    if (config) {
        // API 密钥已移至服务端，不再显示在客户端
    }
}

// 处理商品图片上传
function handleProductUpload(event) {
    const file = event.target.files[0];
    if (file) {
        productFile = file;
        showProductPreview(file);
    }
}

// 显示商品图片预览
function showProductPreview(file) {
    const previewGrid = document.getElementById('product-preview-grid');
    const previewContainer = document.getElementById('product-preview-container');
    const productUploadArea = document.getElementById('product-upload-area');

    previewGrid.innerHTML = '';
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <img src="${e.target.result}" alt="商品图片">
            <button class="remove-single-btn" onclick="removeProduct()">×</button>
        `;
        previewGrid.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
    previewContainer.style.display = 'block';
    productUploadArea.style.display = 'none'; // 隐藏上传占位符
}

// 移除商品图片
function removeProduct() {
    productFile = null;
    document.getElementById('product-upload').value = '';
    document.getElementById('product-preview-grid').innerHTML = '';
    document.getElementById('product-preview-container').style.display = 'none';
    document.getElementById('product-upload-area').style.display = 'block'; // 显示上传占位符
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
    if (!productFile) {
        showError('请上传商品图片');
        return;
    }

    // 积分检查
    if (window.KtoonPoints) {
        var loggedIn = localStorage.getItem('ktoon_logged_in');
        if (!loggedIn) {
            showError('请先登录');
            return;
        }
        var result = window.KtoonPoints.deduct('product');
        if (!result.ok) {
            showError('积分不足，生成图片需要 2 积分，当前剩余 ' + result.remaining + ' 积分');
            return;
        }
        if (window.parent && window.parent.refreshPointsDisplay) {
            window.parent.refreshPointsDisplay();
        }
    }

    // 生成提示词
    let prompt = promptInput.value.trim();

    // 如果没有输入提示词，使用默认提示词
    if (!prompt) {
        prompt = '高质量电商商品图，专业摄影，高清画质，专业后期，真实质感';
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
            requestData = {
                model: config.model,
                prompt: prompt,
                image: productFile, // 发送商品图片的文件对象
                response_format: "url",
                size: size
            };
        } else if (model === 'doubao-4.0-i2i') {
            // 读取图片并调整尺寸，传完整 data:image 格式
            const productBase64 = await readFileAsBase64(productFile, size);

            requestData = {
                model: config.model,
                prompt: prompt,
                image: productBase64,
                response_format: "url",
                size: size
            };
        }

        // 调试：显示请求数据
        console.log('请求模型:', requestData.model);
        console.log('请求提示词:', requestData.prompt);
        console.log('API 类型:', config.type);

        let response;

        // 根据模型和API端点选择不同的请求格式
        if (model === 'nano-banana-i2i') {
            // Nano-banana 图生图 - 通过统一代理（密钥在服务端）
            let fileData = null;
            if (typeof requestData.image === 'string' && requestData.image.startsWith('data:')) {
                fileData = { fieldName: 'image', name: 'image.png', contentType: 'image/png', base64: requestData.image };
            }

            response = await fetch('/api-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'nano-banana-edit',
                    data: {
                        fields: { model: requestData.model, prompt: requestData.prompt, response_format: requestData.response_format },
                        file: fileData
                    },
                    format: 'formdata'
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
            }
        } else {
            // Doubao 图生图 - 通过统一代理（密钥在服务端）
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
            KtoonPoints.refund('product');
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
    removeProduct();
    hideResult();
    hideError();
    historySelect.value = '';
    promptInput.value = '';
    aspectRatioSelect.value = '9:16';
}

// AI润色提示词
async function aiPolishPrompt() {
    const originalPrompt = promptInput.value.trim();

    if (!originalPrompt) {
        showError('请输入需要润色的提示词');
        return;
    }

    // 显示润色中状态
    const originalText = aiPolishBtn.textContent;
    aiPolishBtn.textContent = '润色中...';
    aiPolishBtn.disabled = true;

    try {
        // 分析原始提示词，判断商品类型
        const promptLower = originalPrompt.toLowerCase();
        let categoryHint = '';

        // 科技产品相关关键词
        const techKeywords = ['手机', '电脑', '平板', '耳机', '手表', '数码', '电子', '科技', '智能', '芯片', '屏幕', '充电', '蓝牙', 'wifi', 'usb', 'camera', 'laptop', 'phone', 'tablet', 'watch', 'headphone'];
        // 化妆品相关关键词
        const cosmeticKeywords = ['口红', '唇膏', '眼影', '粉底', '香水', '面膜', '护肤品', '化妆品', '彩妆', '精华', '乳液', '面霜', '眼霜', '腮红', '睫毛膏', '眉笔', '化妆', '美容', '护肤', 'lips', 'lipstick', 'mascara', 'perfume', 'makeup', 'cosmetic', 'skincare'];
        // 服装相关关键词
        const clothingKeywords = ['衣服', '服装', '裙子', '衬衫', 'T恤', '外套', '裤子', '鞋子', '包包', '配饰', '首饰', '手表', '围巾', '帽子', 'dress', 'shirt', 'shoes', 'bag', 'jewelry', 'accessories'];
        // 食品相关关键词
        const foodKeywords = ['食品', '饮料', '咖啡', '茶', '蛋糕', '甜点', '水果', '零食', '美食', '餐饮', 'coffee', 'tea', 'cake', 'dessert', 'fruit', 'snack', 'food', 'drink'];

        // 判断商品类型并添加相应的预设描述
        if (techKeywords.some(keyword => promptLower.includes(keyword))) {
            categoryHint = `科技产品描述建议：
- 强调产品的科技感和未来感
- 使用冷色调光线（蓝色、银色、白色）
- 突出产品的精密工艺和材质
- 可以添加科技元素如光线线条、电路板纹理等
- 背景可以使用简约的科技风格`;
        } else if (cosmeticKeywords.some(keyword => promptLower.includes(keyword))) {
            categoryHint = `化妆品描述建议：
- 强调产品的浪漫和优雅气质
- 使用暖色调光线（粉色、金色、柔和光线）
- 突出产品的质感和光泽
- 可以添加浪漫元素如花瓣、丝绸、珠宝等
- 背景可以使用温馨柔美的风格`;
        } else if (clothingKeywords.some(keyword => promptLower.includes(keyword))) {
            categoryHint = `服装描述建议：
- 强调产品的时尚感和质感
- 使用自然光线或专业影棚灯光
- 突出面料的纹理和剪裁
- 可以添加时尚元素如模特展示、搭配场景等
- 背景可以使用简约或时尚风格`;
        } else if (foodKeywords.some(keyword => promptLower.includes(keyword))) {
            categoryHint = `食品描述建议：
- 强调产品的新鲜度和美味感
- 使用温暖明亮的光线
- 突出食材的质感和色彩
- 可以添加食欲元素如蒸汽、酱汁、配料等
- 背景可以使用温馨的用餐环境`;
        } else {
            categoryHint = `通用商品描述建议：
- 强调产品的专业性和品质感
- 使用合适的光线和背景
- 突出产品的特点和卖点
- 保持画面简洁大方
- 确保主体清晰突出`;
        }

        // 构建润色提示词 - 告诉模型要润色出AI商品图生成的提示词
        const polishPrompt = `请优化以下提示词，使其适合AI商品图生成：

原始提示词：${originalPrompt}

${categoryHint}

要求：
1. 优化描述，使其更加专业、详细和生动
2. 突出商品特点和卖点
3. 添加专业的摄影和光线描述
4. 根据商品类型添加相应的元素描述
5. 保持中文输出
6. 输出格式直接是优化后的提示词，不要包含其他说明文字`;

        // 构建请求数据 - 使用聊天模型
        const requestData = {
            model: "doubao-pro-4k",
            messages: [
                {
                    role: "system",
                    content: "你是一个专业的AI商品图提示词优化助手，擅长将简单的商品描述转化为专业、生动的AI绘画提示词。"
                },
                {
                    role: "user",
                    content: polishPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 500
        };

        // 使用代理方式发送请求（与图像生成相同的方式）
        const proxyBody = {
            model: 'doubao-pro-4k',
            data: requestData
        };

        const response = await fetch('/api-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(proxyBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`润色请求失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // 提取润色后的提示词
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const polishedPrompt = data.choices[0].message.content;
            promptInput.value = polishedPrompt;
        } else {
            // 如果API返回格式不正确，使用本地润色函数
            console.log('API返回格式不正确，使用本地润色函数');
            const polishedPrompt = localPolishPrompt(originalPrompt);
            promptInput.value = polishedPrompt;
        }

    } catch (error) {
        console.error('AI润色API请求失败:', error);
        // 当API请求失败时，使用本地润色函数
        console.log('切换到本地润色模式');
        const polishedPrompt = localPolishPrompt(originalPrompt);
        promptInput.value = polishedPrompt;
        // 不显示错误，因为本地润色已经成功
    } finally {
        aiPolishBtn.textContent = originalText;
        aiPolishBtn.disabled = false;
    }
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

// 本地润色函数 - 当API不可用时使用
function localPolishPrompt(originalPrompt) {
    const promptLower = originalPrompt.toLowerCase();

    // 根据商品类型选择不同的模板
    let categoryTemplates = {};

    // 科技产品模板
    if (['手机', '电脑', '平板', '耳机', '手表', '数码', '电子', '科技', '智能'].some(k => promptLower.includes(k))) {
        categoryTemplates = {
            polish: [
                '未来科技感，',
                '精密工艺，',
                '高端科技产品，'
            ],
            lighting: [
                '冷色调光线，',
                '蓝色科技光，',
                '银色金属光泽，'
            ],
            background: [
                '简约科技背景，',
                '深色背景，',
                '渐变背景，'
            ],
            elements: [
                '光线线条，',
                '电路纹理，',
                '科技感光效，'
            ]
        };
    }
    // 化妆品模板
    else if (['口红', '唇膏', '眼影', '粉底', '香水', '面膜', '护肤品', '化妆品', '彩妆'].some(k => promptLower.includes(k))) {
        categoryTemplates = {
            polish: [
                '浪漫优雅，',
                '精致美妆，',
                '高端化妆品，'
            ],
            lighting: [
                '暖色调光线，',
                '粉色柔光，',
                '金色光泽，'
            ],
            background: [
                '温馨背景，',
                '粉色背景，',
                '花瓣背景，'
            ],
            elements: [
                '花瓣装饰，',
                '丝绸质感，',
                '珠宝点缀，'
            ]
        };
    }
    // 服装模板
    else if (['衣服', '服装', '裙子', '衬衫', 'T恤', '外套', '裤子', '鞋子', '包包'].some(k => promptLower.includes(k))) {
        categoryTemplates = {
            polish: [
                '时尚潮流，',
                '质感面料，',
                '精致剪裁，'
            ],
            lighting: [
                '自然光线，',
                '专业影棚灯光，',
                '柔和光线，'
            ],
            background: [
                '简约背景，',
                '时尚背景，',
                '模特展示，'
            ],
            elements: [
                '面料纹理，',
                '时尚搭配，',
                '质感细节，'
            ]
        };
    }
    // 食品模板
    else if (['食品', '饮料', '咖啡', '茶', '蛋糕', '甜点', '水果', '零食', '美食'].some(k => promptLower.includes(k))) {
        categoryTemplates = {
            polish: [
                '新鲜美味，',
                '食欲诱人，',
                '精致美食，'
            ],
            lighting: [
                '温暖光线，',
                '明亮光线，',
                '自然光，'
            ],
            background: [
                '温馨背景，',
                '用餐环境，',
                '简约背景，'
            ],
            elements: [
                '蒸汽效果，',
                '酱汁点缀，',
                '配料装饰，'
            ]
        };
    }
    // 通用模板
    else {
        categoryTemplates = {
            polish: [
                '高质量电商商品图，',
                '专业级商品展示，',
                '商业摄影，'
            ],
            lighting: [
                '柔和自然光，',
                '专业影棚灯光，',
                '明亮均匀光线，'
            ],
            background: [
                '纯白背景，',
                '简约背景，',
                '专业背景，'
            ],
            elements: [
                '精致细节，',
                '真实质感，',
                '专业后期，'
            ]
        };
    }

    // 随机选择模板组合
    const randomTemplate = (templates) => templates[Math.floor(Math.random() * templates.length)];

    // 构建润色后的提示词
    let polishedPrompt = randomTemplate(categoryTemplates.polish) +
                        randomTemplate(categoryTemplates.lighting) +
                        randomTemplate(categoryTemplates.background) +
                        originalPrompt +
                        randomTemplate(categoryTemplates.elements) +
                        '高清画质，专业后期';

    // 如果原提示词中没有商品相关词汇，添加通用描述
    if (!polishedPrompt.includes('商品') && !polishedPrompt.includes('产品') && !polishedPrompt.includes('物品')) {
        polishedPrompt = '商品展示，' + polishedPrompt;
    }

    return polishedPrompt;
}

// 启动应用
init();
