// ==UserScript==
// @name         即梦AI作品采集助手
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  采集即梦AI的作品图片和提示词
// @match        *://jimeng.jianying.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[即梦采集助手] 已加载 v2.0');

    var collectedWorks = [];
    var currentWork = null;
    var lastDetailImg = '';

    try {
        collectedWorks = JSON.parse(localStorage.getItem('jimeng_collected') || '[]');
    } catch(e) { collectedWorks = []; }

    // ========== 创建悬浮面板 ==========
    function createPanel() {
        var panel = document.createElement('div');
        panel.id = 'jc-panel';
        panel.style.cssText = 'position:fixed;right:20px;top:100px;width:300px;background:#1a1a2e;border:1px solid #444;border-radius:12px;z-index:999999;font-family:-apple-system,sans-serif;color:#e0e0e0;box-shadow:0 8px 32px rgba(0,0,0,0.6);';

        panel.innerHTML =
            '<div id="jc-head" style="display:flex;align-items:center;padding:12px 14px;background:#16213e;border-radius:12px 12px 0 0;cursor:move;gap:8px;font-size:14px;font-weight:600;">' +
                '<span>即梦采集助手</span>' +
                '<span id="jc-cnt" style="background:#0f3460;color:#00d2ff;padding:2px 8px;border-radius:10px;font-size:12px;margin-left:auto;">' + collectedWorks.length + '</span>' +
                '<button id="jc-min" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;padding:0 4px;">−</button>' +
            '</div>' +
            '<div id="jc-body" style="padding:12px;">' +
                '<div id="jc-cur" style="display:none;background:#0f3460;border-radius:8px;padding:10px;margin-bottom:10px;">' +
                    '<img id="jc-img" style="width:100%;border-radius:6px;max-height:140px;object-fit:cover;" src="">' +
                    '<div id="jc-prompt" style="font-size:11px;color:#aaa;margin-top:8px;max-height:60px;overflow-y:auto;line-height:1.5;word-break:break-all;"></div>' +
                '</div>' +
                '<div id="jc-tip" style="color:#666;font-size:12px;text-align:center;padding:16px 0;">点击作品查看详情后可采集</div>' +
                '<button id="jc-btn-collect" style="display:none;width:100%;padding:8px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;background:#00d2ff;color:#000;margin-top:6px;">采集当前作品</button>' +
                '<div style="display:flex;gap:6px;margin-top:8px;">' +
                    '<button id="jc-btn-export" style="flex:1;padding:8px;border:none;border-radius:6px;cursor:pointer;font-size:12px;background:#533483;color:#fff;">导出JSON</button>' +
                    '<button id="jc-btn-clear" style="flex:1;padding:8px;border:none;border-radius:6px;cursor:pointer;font-size:12px;background:transparent;color:#888;border:1px solid #444;">清空</button>' +
                '</div>' +
                '<div id="jc-status" style="color:#555;font-size:11px;margin-top:8px;text-align:center;">等待点击作品...</div>' +
                '<div id="jc-list" style="margin-top:10px;"></div>' +
            '</div>';

        document.body.appendChild(panel);

        document.getElementById('jc-min').onclick = function() {
            var body = document.getElementById('jc-body');
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
        };

        document.getElementById('jc-btn-collect').onclick = function() {
            if (!currentWork) return;
            if (collectedWorks.some(function(w){ return w.imageUrl === currentWork.imageUrl; })) {
                toast('已采集过此作品');
                return;
            }
            collectedWorks.push({
                id: collectedWorks.length + 1,
                imageUrl: currentWork.imageUrl,
                prompt: currentWork.prompt || '',
                author: currentWork.author || ''
            });
            localStorage.setItem('jimeng_collected', JSON.stringify(collectedWorks));
            updateList();
            toast('已采集 #' + collectedWorks.length);
        };

        document.getElementById('jc-btn-export').onclick = function() {
            if (collectedWorks.length === 0) { toast('还没有采集数据'); return; }
            var json = JSON.stringify(collectedWorks, null, 2);
            var blob = new Blob([json], {type: 'application/json'});
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'jimeng-' + collectedWorks.length + '.json';
            a.click();
            toast('已导出 ' + collectedWorks.length + ' 条');
        };

        document.getElementById('jc-btn-clear').onclick = function() {
            if (confirm('确定清空 ' + collectedWorks.length + ' 条数据？')) {
                collectedWorks = [];
                localStorage.setItem('jimeng_collected', '[]');
                updateList();
                toast('已清空');
            }
        };

        // 拖拽
        var head = document.getElementById('jc-head');
        var dragging = false, dx, dy;
        head.onmousedown = function(e) {
            dragging = true;
            dx = e.clientX - panel.offsetLeft;
            dy = e.clientY - panel.offsetTop;
            document.onmousemove = function(e) {
                if (!dragging) return;
                panel.style.left = (e.clientX - dx) + 'px';
                panel.style.top = (e.clientY - dy) + 'px';
                panel.style.right = 'auto';
            };
            document.onmouseup = function() { dragging = false; };
        };

        updateList();
    }

    function updateList() {
        document.getElementById('jc-cnt').textContent = collectedWorks.length;
        var list = document.getElementById('jc-list');
        list.innerHTML = '';
        var recent = collectedWorks.slice(-5).reverse();
        for (var i = 0; i < recent.length; i++) {
            var w = recent[i];
            var item = document.createElement('div');
            item.style.cssText = 'display:flex;gap:8px;padding:6px;background:#16213e;border-radius:6px;margin-bottom:4px;align-items:center;';
            item.innerHTML = '<img src="' + w.imageUrl + '" style="width:36px;height:36px;border-radius:4px;object-fit:cover;" onerror="this.style.display=\'none\'">' +
                '<div style="flex:1;overflow:hidden;font-size:11px;color:#888;white-space:nowrap;text-overflow:ellipsis;">' + (w.prompt || '无提示词') + '</div>';
            list.appendChild(item);
        }
    }

    function showWork(work) {
        currentWork = work;
        document.getElementById('jc-cur').style.display = 'block';
        document.getElementById('jc-tip').style.display = 'none';
        document.getElementById('jc-btn-collect').style.display = 'block';
        document.getElementById('jc-img').src = work.imageUrl;
        document.getElementById('jc-prompt').textContent = work.prompt || '未检测到提示词';
        document.getElementById('jc-status').textContent = '已检测到作品，点击"采集"';
        console.log('[即梦] 检测到作品:', work.imageUrl.substring(0, 80), '提示词长度:', (work.prompt || '').length);
    }

    function toast(msg) {
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,210,255,0.95);color:#000;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999999;';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function(){ t.remove(); }, 1500);
    }

    // ========== 检测详情弹窗 ==========
    function detectDetail() {
        // 查找所有图片
        var imgs = document.querySelectorAll('img');
        var candidates = [];

        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            var src = img.src || '';
            if (!src) continue;
            // 只要 byteimg 图片，且包含 tplv（即梦图片特征）
            if (src.indexOf('byteimg') === -1) continue;
            if (src.indexOf('tplv') === -1) continue;
            // 跳过头像（通常是小图或包含 avatar/face 等关键词）
            if (src.indexOf('avatar') !== -1 || src.indexOf('face') !== -1 || src.indexOf('head') !== -1) continue;

            var rect = img.getBoundingClientRect();
            if (rect.width < 200 || rect.height < 200) continue;

            candidates.push({ img: img, src: src, width: rect.width, height: rect.height, area: rect.width * rect.height });
        }

        if (candidates.length === 0) return;

        // 按面积从大到小排序，取最大的
        candidates.sort(function(a, b) { return b.area - a.area; });
        var best = candidates[0];

        if (best.src === lastDetailImg) return;
        lastDetailImg = best.src;

        // 在详情区域找提示词
        var prompt = findPromptNearImage(best.img);

        console.log('[即梦] 新图片:', best.src.substring(0, 60), best.width + 'x' + best.height);
        showWork({ imageUrl: best.src, prompt: prompt, author: '' });
    }

    // 清理提示词，去掉UI噪声
    function cleanPrompt(raw) {
        var text = raw;

        // 策略A: 截取 "提示词" 之后到 "图片 X.X" 或 "更多" 之间的文字
        var m = text.match(/提示词(.+?)(?:图片\s*\d+\.\d+|更多|$)/s);
        if (m && m[1].trim().length > 5) {
            text = m[1].trim();
            return text;
        }

        // 策略B: 去掉常见的UI噪声文字
        var noisePatterns = [
            /Seedance[\s\S]*?创意无限可能/g,
            /Agent\s*模式[\s\S]*?创意设计/g,
            /\d+\/\d+生成中\.\.\./g,
            /去查看/g,
            /关注\d+/g,
            /\d{4}-\d{2}-\d{2}/g,
            /内容由\s*AI\s*生成/g,
            /图片\s*提示词/g,
            /图片\s*\d+\.\d+\s*\d+:\d+/g,
            /\d+:\d+/g,
            /更多/g,
            /做同款/g,
            /用作参考图/g,
            /生成/g,
            /同款/g
        ];
        for (var i = 0; i < noisePatterns.length; i++) {
            text = text.replace(noisePatterns[i], '');
        }
        text = text.trim();

        // 如果清理后文字太短，可能清过头了，返回原始最长段落
        if (text.length < 10) {
            // 按常见分隔符拆分，取最长一段
            var parts = raw.split(/(?:Seedance|Agent|去查看|关注\d|内容由|图片|更多|做同款|用作参考图|\d{4}-\d{2}-\d{2}|\d+\/\d+生成)/);
            var longest = '';
            for (var j = 0; j < parts.length; j++) {
                var p = parts[j].trim();
                if (p.length > longest.length && p.length > 10) {
                    longest = p;
                }
            }
            if (longest) text = longest;
        }

        return text;
    }

    function findPromptNearImage(imgEl) {
        // 策略1: 查找包含 "提示词" 标签的元素，取其相邻文本
        var allEls = document.querySelectorAll('div, span, p');
        var promptFromLabel = '';
        for (var a = 0; a < allEls.length; a++) {
            var el = allEls[a];
            var t = el.textContent.trim();
            if (t === '图片提示词' || t === '提示词' || t.indexOf('提示词') === 0) {
                // 找到提示词标签，取其父元素或下一个兄弟元素的文本
                var parent = el.parentElement;
                if (parent) {
                    var siblings = parent.querySelectorAll('div, span');
                    for (var s = 0; s < siblings.length; s++) {
                        var st = siblings[s].textContent.trim();
                        if (st.length > 15 && st.indexOf('提示词') === -1) {
                            var cleaned = cleanPrompt(st);
                            if (cleaned.length > 10 && cleaned.length > promptFromLabel.length) {
                                promptFromLabel = cleaned;
                            }
                        }
                    }
                }
                // 也尝试往上一级
                if (!promptFromLabel && parent && parent.parentElement) {
                    var gp = parent.parentElement;
                    var gpTexts = gp.querySelectorAll('div, span');
                    for (var g = 0; g < gpTexts.length; g++) {
                        var gt = gpTexts[g].textContent.trim();
                        if (gt.length > 15 && gt.indexOf('提示词') === -1 && gt.indexOf('做同款') === -1 && gt.indexOf('去查看') === -1) {
                            var gc = cleanPrompt(gt);
                            if (gc.length > 10 && gc.length > promptFromLabel.length) {
                                promptFromLabel = gc;
                            }
                        }
                    }
                }
            }
        }
        if (promptFromLabel) return promptFromLabel;

        // 策略2: 在同一父容器中找提示词
        var container = imgEl.closest('[class*="detail"]') ||
                        imgEl.closest('[class*="modal"]') ||
                        imgEl.closest('[class*="dialog"]') ||
                        imgEl.closest('[class*="content"]') ||
                        imgEl.parentElement.parentElement.parentElement;

        if (container) {
            var texts = container.querySelectorAll('div, span, p');
            var bestPrompt = '';
            for (var i = 0; i < texts.length; i++) {
                var el2 = texts[i];
                var t2 = el2.textContent.trim();
                if (t2.length > 15 && t2.length < 2000 && el2.children.length < 3) {
                    var cleaned2 = cleanPrompt(t2);
                    if (cleaned2.length > 10 && cleaned2.length > bestPrompt.length) {
                        bestPrompt = cleaned2;
                    }
                }
            }
            if (bestPrompt) return bestPrompt;
        }

        // 策略3: 找图片附近的提示词（DOM位置接近）
        var prompt = '';
        var imgRect = imgEl.getBoundingClientRect();
        for (var j = 0; j < allEls.length; j++) {
            var el3 = allEls[j];
            var t3 = el3.textContent.trim();
            if (t3.length < 15 || t3.length > 2000 || el3.children.length >= 3) continue;
            var r3 = el3.getBoundingClientRect();
            if (r3.top >= imgRect.top - 50 && r3.top <= imgRect.bottom + 50 && r3.width > 50) {
                var cleaned3 = cleanPrompt(t3);
                if (cleaned3.length > 10 && cleaned3.length > prompt.length) {
                    prompt = cleaned3;
                }
            }
        }
        return prompt;
    }

    // ========== 启动检测 ==========
    function startDetect() {
        // 每800ms检测一次
        setInterval(detectDetail, 800);
        console.log('[即梦采集助手] 检测已启动');
    }

    // ========== 初始化 ==========
    function init() {
        if (!document.body) {
            setTimeout(init, 500);
            return;
        }
        createPanel();
        startDetect();
        console.log('[即梦采集助手] 已启动 v2.0');
    }

    init();
})();
