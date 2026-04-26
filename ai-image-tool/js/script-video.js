// script-video.js - AI 视频生成 (DashScope 万相模型)
(function() {
    'use strict';

    // ========== Style Presets ==========
    var STYLE_PRESETS = {
        'cinematic': '电影感画面，专业灯光，浅景深，宽银幕构图',
        'realistic': '超写实风格，自然光照，真实质感',
        'anime': '日系动漫风格，鲜艳色彩，流畅线条',
        'cyberpunk': '赛博朋克风格，霓虹灯光，未来都市',
        'fantasy': '奇幻风格，魔法氛围，梦幻光影',
        'retro': '复古风格，胶片质感，温暖色调'
    };

    // ========== State ==========
    var isGenerating = false;
    var currentTaskId = null;
    var pollTimer = null;
    var history = JSON.parse(localStorage.getItem('ktoonai_video_history') || '[]');
    var mediaItems = []; // { type: 'image'|'video'|'audio', file: File, dataUrl: string, url: string }

    // ========== DOM Elements ==========
    var regionSelect = document.getElementById('region');
    var modelSelect = document.getElementById('model-select');
    var promptInput = document.getElementById('prompt');
    var styleSelect = document.getElementById('style');
    var durationSelect = document.getElementById('duration');
    var resolutionSelect = document.getElementById('resolution');
    var sizeSelect = document.getElementById('size');
    var aspectRatioSelect = document.getElementById('aspect-ratio');
    var promptExtendSelect = document.getElementById('prompt-extend');
    var watermarkSelect = document.getElementById('watermark');
    var negativePromptInput = document.getElementById('negative-prompt');
    var generateBtn = document.getElementById('generate-btn');
    var cancelBtn = document.getElementById('cancel-btn');
    var clearBtn = document.getElementById('clear-btn');
    var loadingDiv = document.getElementById('loading');
    var genQueue = document.getElementById('gen-queue');
    var resultVideo = document.getElementById('result-video');
    var generatedVideo = document.getElementById('generated-video');
    var downloadBtn = document.getElementById('download-btn');
    var copyUrlBtn = document.getElementById('copy-url-btn');
    var errorMessage = document.getElementById('error-message');
    var historySection = document.getElementById('history-section');
    var historyList = document.getElementById('history-list');
    var clearHistoryBtn = document.getElementById('clear-history-btn');
    var resolutionGroup = document.getElementById('resolution-group');
    var sizeGroup = document.getElementById('size-group');
    var mediaSection = document.getElementById('media-section');
    var mediaList = document.getElementById('media-list');
    var addImageBtn = document.getElementById('add-image-btn');
    var addVideoBtn = document.getElementById('add-video-btn');
    var addAudioBtn = document.getElementById('add-audio-btn');
    var mediaImageInput = document.getElementById('media-image-input');
    var mediaVideoInput = document.getElementById('media-video-input');
    var mediaAudioInput = document.getElementById('media-audio-input');

    // ========== Size Options Per Model ==========
    var SIZE_OPTIONS = {
        'wan2.6-t2v': [
            { value: '1280*720', text: '720P (1280x720)' },
            { value: '1920*1080', text: '1080P (1920x1080)' },
            { value: '720*1280', text: '720P 竖屏 (720x1280)' },
            { value: '1080*1920', text: '1080P 竖屏 (1080x1920)' }
        ],
        'wan2.6-t2v-us': [
            { value: '1280*720', text: '720P (1280x720)' },
            { value: '1920*1080', text: '1080P (1920x1080)' },
            { value: '720*1280', text: '720P 竖屏 (720x1280)' },
            { value: '1080*1920', text: '1080P 竖屏 (1080x1920)' }
        ],
        'wan2.5-t2v-preview': [
            { value: '1280*720', text: '720P (1280x720)' },
            { value: '1920*1080', text: '1080P (1920x1080)' },
            { value: '720*1280', text: '720P 竖屏 (720x1280)' },
            { value: '1080*1920', text: '1080P 竖屏 (1080x1920)' }
        ],
        'wan2.2-t2v-plus': [
            { value: '1920*1080', text: '1080P 横屏 (1920x1080)' },
            { value: '1080*1920', text: '1080P 竖屏 (1080x1920)' },
            { value: '1440*1440', text: '1440P 方形 (1440x1440)' },
            { value: '1632*1248', text: '1632x1248' },
            { value: '1248*1632', text: '1248x1632' },
            { value: '832*480', text: '480P 横屏 (832x480)' },
            { value: '480*832', text: '480P 竖屏 (480x832)' },
            { value: '624*624', text: '624P 方形 (624x624)' }
        ]
    };

    function isR2VModel(model) {
        return model === 'wan2.7-r2v';
    }

    function isWan27Model(model) {
        return model === 'wan2.7-t2v' || model === 'wan2.7-r2v';
    }

    // ========== Model Change Handler ==========
    modelSelect.addEventListener('change', function() {
        var model = this.value;

        // Show/hide media section for r2v
        if (isR2VModel(model)) {
            mediaSection.style.display = '';
        } else {
            mediaSection.style.display = 'none';
        }

        // wan2.7 uses resolution/ratio, wan2.6 and earlier use size
        if (isWan27Model(model)) {
            resolutionGroup.style.display = '';
            sizeGroup.style.display = 'none';
        } else {
            resolutionGroup.style.display = 'none';
            sizeGroup.style.display = '';
            var sizes = SIZE_OPTIONS[model] || SIZE_OPTIONS['wan2.6-t2v'];
            var currentSize = sizeSelect.value;
            sizeSelect.innerHTML = '';
            sizes.forEach(function(s) {
                var opt = document.createElement('option');
                opt.value = s.value;
                opt.textContent = s.text;
                if (s.value === currentSize) opt.selected = true;
                sizeSelect.appendChild(opt);
            });
        }

        // Update duration options based on model
        var currentVal = parseInt(durationSelect.value) || 5;
        durationSelect.innerHTML = '';
        durationSelect.disabled = false;

        if (model === 'wan2.7-t2v' || model === 'wan2.6-t2v') {
            for (var i = 2; i <= 15; i++) {
                var opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i + ' 秒';
                if (i === currentVal) opt.selected = true;
                durationSelect.appendChild(opt);
            }
        } else if (isR2VModel(model)) {
            // r2v: 2-10 if has video reference, 2-15 if not
            var hasVideo = mediaItems.some(function(m) { return m.type === 'video'; });
            var maxDur = hasVideo ? 10 : 15;
            for (var i = 2; i <= maxDur; i++) {
                var opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i + ' 秒';
                if (i === currentVal) opt.selected = true;
                durationSelect.appendChild(opt);
            }
        } else if (model === 'wan2.6-t2v-us' || model === 'wan2.5-t2v-preview') {
            [5, 10].forEach(function(v) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v + ' 秒';
                if (v === currentVal || v === 5) opt.selected = true;
                durationSelect.appendChild(opt);
            });
        } else {
            var opt = document.createElement('option');
            opt.value = 5;
            opt.textContent = '5 秒 (固定)';
            opt.selected = true;
            durationSelect.appendChild(opt);
            durationSelect.disabled = true;
        }
    });

    // ========== Media Upload Handlers ==========
    addImageBtn.addEventListener('click', function() { mediaImageInput.click(); });
    addVideoBtn.addEventListener('click', function() { mediaVideoInput.click(); });
    addAudioBtn.addEventListener('click', function() { mediaAudioInput.click(); });

    mediaImageInput.addEventListener('change', function(e) {
        var files = Array.from(e.target.files);
        files.forEach(function(file) {
            if (file.size > 20 * 1024 * 1024) {
                showToast('图片 ' + file.name + ' 超过 20MB 限制', 'error');
                return;
            }
            var reader = new FileReader();
            reader.onload = function(ev) {
                mediaItems.push({ type: 'image', file: file, dataUrl: ev.target.result });
                renderMediaList();
                updateDurationOptions();
            };
            reader.readAsDataURL(file);
        });
        mediaImageInput.value = '';
    });

    mediaVideoInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 100 * 1024 * 1024) {
            showToast('视频超过 100MB 限制', 'error');
            return;
        }
        // Upload video to server for temporary hosting
        uploadMediaFile(file, 'video');
        mediaVideoInput.value = '';
    });

    mediaAudioInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) {
            showToast('音频超过 15MB 限制', 'error');
            return;
        }
        uploadMediaFile(file, 'audio');
        mediaAudioInput.value = '';
    });

    function uploadMediaFile(file, type) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        showToast('正在上传 ' + file.name + '...');

        fetch('/media-upload', {
            method: 'POST',
            body: formData
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.error) {
                showToast('上传失败: ' + data.error, 'error');
                return;
            }
            mediaItems.push({ type: type, file: file, url: data.url });
            renderMediaList();
            updateDurationOptions();
            showToast(file.name + ' 上传成功');
        })
        .catch(function(err) {
            showToast('上传失败: ' + err.message, 'error');
        });
    }

    function renderMediaList() {
        mediaList.innerHTML = '';
        mediaItems.forEach(function(item, index) {
            var div = document.createElement('div');
            div.className = 'media-item';

            var typeLabel = item.type === 'image' ? '图片' : item.type === 'video' ? '视频' : '音色';
            var typeIndex = 0;
            for (var i = 0; i <= index; i++) {
                if (mediaItems[i].type === item.type) typeIndex++;
            }
            var refLabel = item.type === 'image' ? '图' + typeIndex : '视频' + typeIndex;

            var preview = '';
            if (item.type === 'image' && item.dataUrl) {
                preview = '<img class="media-item-preview" src="' + item.dataUrl + '">';
            } else if (item.type === 'video') {
                preview = '<div class="media-item-preview" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🎬</div>';
            } else {
                preview = '<div class="media-item-preview" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🎤</div>';
            }

            div.innerHTML = preview +
                '<div class="media-item-info">' +
                    '<div class="media-item-name">' + refLabel + ' - ' + item.file.name + '</div>' +
                    '<div class="media-item-type">' + typeLabel + ' · ' + formatFileSize(item.file.size) + '</div>' +
                '</div>' +
                '<button class="media-item-remove" data-index="' + index + '">&times;</button>';

            div.querySelector('.media-item-remove').addEventListener('click', function() {
                mediaItems.splice(index, 1);
                renderMediaList();
                updateDurationOptions();
            });

            mediaList.appendChild(div);
        });
    }

    function updateDurationOptions() {
        if (isR2VModel(modelSelect.value)) {
            modelSelect.dispatchEvent(new Event('change'));
        }
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ========== Build Request Body ==========
    function buildRequestBody(model, prompt) {
        var duration = parseInt(durationSelect.value) || 5;
        var ratio = aspectRatioSelect.value;
        var promptExtend = promptExtendSelect.value === 'true';
        var watermark = watermarkSelect.value === 'true';
        var negativePrompt = negativePromptInput.value.trim();

        var body = {
            model: model,
            input: {
                prompt: prompt
            },
            parameters: {
                ratio: ratio,
                duration: duration,
                prompt_extend: promptExtend,
                watermark: watermark
            }
        };

        if (negativePrompt) {
            body.input.negative_prompt = negativePrompt;
        }

        if (isWan27Model(model)) {
            body.parameters.resolution = resolutionSelect.value;
        } else {
            body.parameters.size = sizeSelect.value;
        }

        // Build media array for r2v model
        if (isR2VModel(model) && mediaItems.length > 0) {
            var media = [];
            mediaItems.forEach(function(item) {
                var mediaObj = {};
                if (item.type === 'image') {
                    mediaObj.type = 'reference_image';
                    mediaObj.url = item.dataUrl; // base64 data URI
                } else if (item.type === 'video') {
                    mediaObj.type = 'reference_video';
                    mediaObj.url = item.url;
                } else if (item.type === 'audio') {
                    // Audio is attached to the previous image/video as reference_voice
                    // Find the last image or video item
                    for (var i = media.length - 1; i >= 0; i--) {
                        if (media[i].type === 'reference_image' || media[i].type === 'reference_video') {
                            media[i].reference_voice = item.url;
                            return;
                        }
                    }
                    // If no image/video found, skip audio
                    showToast('音色需要搭配图片或视频使用', 'error');
                    return;
                }
                media.push(mediaObj);
            });
            body.input.media = media;
        }

        return body;
    }

    // ========== Generate Video ==========
    function generateVideo() {
        var prompt = promptInput.value.trim();
        if (!prompt) {
            showToast('请输入提示词', 'error');
            return;
        }

        // 积分检查
        if (window.KtoonPoints) {
            var loggedIn = localStorage.getItem('ktoon_logged_in');
            if (!loggedIn) {
                showToast('请先登录', 'error');
                return;
            }
            var result = window.KtoonPoints.deduct('video');
            if (!result.ok) {
                showToast('积分不足，生成视频需要 10 积分，当前剩余 ' + result.remaining + ' 积分', 'error');
                return;
            }
            if (window.parent && window.parent.refreshPointsDisplay) {
                window.parent.refreshPointsDisplay();
            }
        }

        var modelValue = modelSelect.value;

        // Validate r2v model requires at least one media item
        if (isR2VModel(modelValue) && mediaItems.length === 0) {
            showToast('参考生视频模型需要至少添加一个参考素材', 'error');
            return;
        }

        // Enhance prompt with style
        var styleValue = styleSelect.value;
        var enhancedPrompt = prompt;
        if (styleValue && STYLE_PRESETS[styleValue]) {
            enhancedPrompt = prompt + '，' + STYLE_PRESETS[styleValue];
        }

        // Build request body
        var requestBody = buildRequestBody(modelValue, enhancedPrompt);

        // Show loading
        isGenerating = true;
        generateBtn.style.display = 'none';
        cancelBtn.style.display = '';
        loadingDiv.classList.remove('hidden');
        resultVideo.classList.add('hidden');
        errorMessage.classList.add('hidden');

        var queueItem = document.createElement('div');
        queueItem.className = 'gen-queue-item';
        queueItem.innerHTML = '<div class="spinner"></div><span class="gen-model">' + getSelectedModelName() + '</span><span class="gen-time">提交中...</span>';
        genQueue.appendChild(queueItem);

        var startTime = Date.now();
        var timer = setInterval(function() {
            var elapsed = Math.floor((Date.now() - startTime) / 1000);
            queueItem.querySelector('.gen-time').textContent = elapsed + 's';
        }, 1000);

        // Create task via proxy
        fetch('/dashscope-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
                data: requestBody,
                region: regionSelect.value
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.code || data.error) {
                clearInterval(timer);
                isGenerating = false;
                generateBtn.style.display = '';
                cancelBtn.style.display = 'none';
                loadingDiv.classList.add('hidden');
                genQueue.innerHTML = '';
                showError(data.message || data.error || '创建任务失败');
                if (window.KtoonPoints) {
                    KtoonPoints.refund('video');
                    if (window.parent && window.parent.refreshPointsDisplay) window.parent.refreshPointsDisplay();
                }
                return;
            }

            var taskId = data.output && data.output.task_id;
            if (!taskId) {
                clearInterval(timer);
                isGenerating = false;
                generateBtn.style.display = '';
                cancelBtn.style.display = 'none';
                loadingDiv.classList.add('hidden');
                genQueue.innerHTML = '';
                showError('未获取到任务 ID');
                if (window.KtoonPoints) {
                    KtoonPoints.refund('video');
                    if (window.parent && window.parent.refreshPointsDisplay) window.parent.refreshPointsDisplay();
                }
                return;
            }

            currentTaskId = taskId;
            queueItem.querySelector('.gen-model').textContent = getSelectedModelName() + ' (任务: ' + taskId.substring(0, 8) + '...)';

            // Start polling
            pollTask(taskId, timer, queueItem, startTime);
        })
        .catch(function(err) {
            clearInterval(timer);
            isGenerating = false;
            generateBtn.style.display = '';
            cancelBtn.style.display = 'none';
            loadingDiv.classList.add('hidden');
            genQueue.innerHTML = '';
            showError('请求失败: ' + err.message);
        });
    }

    // ========== Poll Task Status ==========
    function pollTask(taskId, timer, queueItem, startTime) {
        var pollInterval = 15000;

        function poll() {
            if (!isGenerating) return;

            fetch('/dashscope-proxy?' + new URLSearchParams({
                task_id: taskId,
                region: regionSelect.value
            }))
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (!isGenerating) return;

                var status = data.output && data.output.task_status;

                if (status === 'SUCCEEDED') {
                    clearInterval(timer);
                    isGenerating = false;
                    currentTaskId = null;
                    generateBtn.style.display = '';
                    cancelBtn.style.display = 'none';
                    loadingDiv.classList.add('hidden');
                    genQueue.innerHTML = '';

                    var videoUrl = data.output.video_url;
                    if (videoUrl) {
                        showResult(videoUrl);
                        addToHistory(videoUrl, promptInput.value.trim());
                        showToast('视频生成成功！');
                    } else {
                        showError('任务成功但未获取到视频 URL');
                    }
                } else if (status === 'FAILED') {
                    clearInterval(timer);
                    isGenerating = false;
                    currentTaskId = null;
                    generateBtn.style.display = '';
                    cancelBtn.style.display = 'none';
                    loadingDiv.classList.add('hidden');
                    genQueue.innerHTML = '';
                    showError('生成失败: ' + (data.output.message || '未知错误'));
                    if (window.KtoonPoints) {
                        KtoonPoints.refund('video');
                        if (window.parent && window.parent.refreshPointsDisplay) window.parent.refreshPointsDisplay();
                    }
                } else if (status === 'CANCELED') {
                    clearInterval(timer);
                    isGenerating = false;
                    currentTaskId = null;
                    generateBtn.style.display = '';
                    cancelBtn.style.display = 'none';
                    loadingDiv.classList.add('hidden');
                    genQueue.innerHTML = '';
                    showToast('任务已取消');
                } else {
                    queueItem.querySelector('.gen-model').textContent = getSelectedModelName() + ' (' + (status === 'PENDING' ? '排队中' : '处理中') + ')';
                    pollTimer = setTimeout(poll, pollInterval);
                }
            })
            .catch(function(err) {
                if (!isGenerating) return;
                pollTimer = setTimeout(poll, pollInterval);
            });
        }

        poll();
    }

    // ========== Cancel ==========
    function cancelGeneration() {
        isGenerating = false;
        currentTaskId = null;
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        generateBtn.style.display = '';
        cancelBtn.style.display = 'none';
        loadingDiv.classList.add('hidden');
        genQueue.innerHTML = '';
        showToast('已取消');
    }

    // ========== Show Result ==========
    function showResult(videoUrl) {
        generatedVideo.src = videoUrl;
        resultVideo.classList.remove('hidden');
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    // ========== History ==========
    function addToHistory(url, prompt) {
        history.unshift({ url: url, prompt: prompt, time: Date.now() });
        if (history.length > 20) history.pop();
        localStorage.setItem('ktoonai_video_history', JSON.stringify(history));
        renderHistory();
    }

    function renderHistory() {
        if (history.length === 0) {
            historySection.style.display = 'none';
            return;
        }
        historySection.style.display = '';
        historyList.innerHTML = '';
        history.forEach(function(item, index) {
            var div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = '<video src="' + item.url + '" muted preload="metadata"></video><button class="history-item-delete" data-index="' + index + '">&times;</button>';
            div.addEventListener('click', function(e) {
                if (e.target.classList.contains('history-item-delete')) {
                    history.splice(index, 1);
                    localStorage.setItem('ktoonai_video_history', JSON.stringify(history));
                    renderHistory();
                    return;
                }
                showResult(item.url);
            });
            historyList.appendChild(div);
        });
    }

    function clearHistory() {
        history = [];
        localStorage.removeItem('ktoonai_video_history');
        renderHistory();
        showToast('历史已清空');
    }

    // ========== Helpers ==========
    function getSelectedModelName() {
        return modelSelect.options[modelSelect.selectedIndex].text;
    }

    function showToast(message, type) {
        type = type || 'success';
        var container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        var icon = type === 'success'
            ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        toast.innerHTML = icon + '<span>' + message + '</span>';
        container.appendChild(toast);
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    }

    // ========== Download ==========
    function downloadVideo() {
        var url = generatedVideo.src;
        if (!url) return;
        var a = document.createElement('a');
        a.href = url;
        a.download = 'ktoonai-video-' + Date.now() + '.mp4';
        a.click();
    }

    function copyUrl() {
        var url = generatedVideo.src;
        if (!url) return;
        navigator.clipboard.writeText(url).then(function() {
            showToast('URL 已复制');
        });
    }

    // ========== Event Listeners ==========
    generateBtn.addEventListener('click', generateVideo);
    cancelBtn.addEventListener('click', cancelGeneration);
    downloadBtn.addEventListener('click', downloadVideo);
    copyUrlBtn.addEventListener('click', copyUrl);
    clearHistoryBtn.addEventListener('click', clearHistory);

    // ========== Init ==========
    renderHistory();
    modelSelect.dispatchEvent(new Event('change'));
})();
