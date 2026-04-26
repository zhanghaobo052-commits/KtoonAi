const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const iconv = require('iconv-lite');

// 加载 API 配置
let CONFIG;
try {
    CONFIG = require('./config.js');
} catch (e) {
    console.error('警告: config.js 不存在，API 代理功能将不可用');
    CONFIG = { MODELS: {} };
}

const port = 80;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // 处理代理请求
    if (req.url === '/proxy' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const targetUrl = data.url;
                const targetData = data.data;
                const apiKey = data.apiKey;

                // 调试日志
                console.log('Proxy request received:');
                console.log('Target URL:', targetUrl);
                console.log('Prompt:', targetData.prompt);
                console.log('Model:', targetData.model);
                console.log('Full request data:', JSON.stringify(targetData, null, 2));

                const urlObj = new URL(targetUrl);
                const options = {
                    hostname: urlObj.hostname,
                    port: 443,
                    path: urlObj.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Length': Buffer.byteLength(JSON.stringify(targetData))
                    }
                };

                const https = require('https');
                const proxyReq = https.request(options, (proxyRes) => {
                    console.log('Proxy response status:', proxyRes.statusCode);
                    console.log('Proxy response headers:', proxyRes.headers);

                    let responseData = '';
                    proxyRes.on('data', (chunk) => {
                        responseData += chunk;
                    });
                    proxyRes.on('end', () => {
                        console.log('Proxy response data length:', responseData.length);
                        console.log('Proxy response data (first 500 chars):', responseData.substring(0, 500));

                        res.writeHead(proxyRes.statusCode, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                        });
                        res.end(responseData);
                    });
                });

                // 设置超时
                let responded = false;
                proxyReq.setTimeout(180000, () => {
                    if (responded) return; responded = true;
                    console.log('Proxy request timeout');
                    res.writeHead(504, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Request timeout' }));
                    proxyReq.destroy();
                });

                proxyReq.on('error', (e) => {
                    if (responded) return; responded = true;
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                });

                proxyReq.write(JSON.stringify(targetData));
                proxyReq.end();
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
        return;
    }

    // ========== 统一 API 代理 ==========
    // 客户端发送 { model, data, format? }，服务端查 config 补充 key 和 url
    if (req.url === '/api-proxy' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { model, data, format } = JSON.parse(body);
                if (!model || !data) {
                    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: '缺少 model 或 data 参数' }));
                    return;
                }

                const modelConfig = CONFIG.MODELS[model];
                if (!modelConfig) {
                    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: '未知模型: ' + model }));
                    return;
                }

                const targetUrl = modelConfig.url;
                const apiKey = modelConfig.key;
                const useFormData = format === 'formdata' || modelConfig.type === 'formdata';

                console.log('[api-proxy] Model:', model, '| URL:', targetUrl);

                const urlObj = new URL(targetUrl);

                if (useFormData) {
                    // FormData 格式（multipart/form-data）
                    // 客户端发送的 data 是 { fields: {key: value}, file: { name, contentType, base64 } }
                    const boundary = '----FormBoundary' + Date.now();
                    let bodyBuffer = Buffer.alloc(0);

                    function addField(name, value) {
                        const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`);
                        const valBuf = Buffer.from(String(value));
                        const footer = Buffer.from('\r\n');
                        bodyBuffer = Buffer.concat([bodyBuffer, header, valBuf, footer]);
                    }

                    function addFile(name, filename, mimeType, fileBuffer) {
                        const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
                        const footer = Buffer.from('\r\n');
                        bodyBuffer = Buffer.concat([bodyBuffer, header, fileBuffer, footer]);
                    }

                    // 添加表单字段
                    if (data.fields) {
                        for (const [key, value] of Object.entries(data.fields)) {
                            addField(key, value);
                        }
                    }

                    // 添加文件
                    if (data.file && data.file.base64) {
                        let b64 = data.file.base64;
                        if (b64.includes(',')) b64 = b64.split(',')[1];
                        const fileBuffer = Buffer.from(b64, 'base64');
                        addFile(data.file.fieldName || 'image', data.file.name || 'image.png', data.file.contentType || 'image/png', fileBuffer);
                    }

                    bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(`--${boundary}--\r\n`)]);

                    const options = {
                        hostname: urlObj.hostname,
                        port: urlObj.port || 443,
                        path: urlObj.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': `multipart/form-data; boundary=${boundary}`,
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Length': bodyBuffer.length
                        }
                    };

                    const proxyReq = https.request(options, (proxyRes) => {
                        let responseData = '';
                        proxyRes.on('data', chunk => { responseData += chunk; });
                        proxyRes.on('end', () => {
                            res.writeHead(proxyRes.statusCode, {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            });
                            res.end(responseData);
                        });
                    });

                    proxyReq.setTimeout(180000, () => {
                        res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                        res.end(JSON.stringify({ error: 'Request timeout' }));
                        proxyReq.destroy();
                    });

                    proxyReq.on('error', (e) => {
                        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                        res.end(JSON.stringify({ error: e.message }));
                    });

                    proxyReq.write(bodyBuffer);
                    proxyReq.end();
                } else {
                    // JSON 格式
                    const jsonData = JSON.stringify(data);
                    const options = {
                        hostname: urlObj.hostname,
                        port: urlObj.port || 443,
                        path: urlObj.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Length': Buffer.byteLength(jsonData)
                        }
                    };

                    const proxyReq = https.request(options, (proxyRes) => {
                        let responseData = '';
                        proxyRes.on('data', chunk => { responseData += chunk; });
                        proxyRes.on('end', () => {
                            res.writeHead(proxyRes.statusCode, {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            });
                            res.end(responseData);
                        });
                    });

                    proxyReq.setTimeout(180000, () => {
                        res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                        res.end(JSON.stringify({ error: 'Request timeout' }));
                        proxyReq.destroy();
                    });

                    proxyReq.on('error', (e) => {
                        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                        res.end(JSON.stringify({ error: e.message }));
                    });

                    proxyReq.write(jsonData);
                    proxyReq.end();
                }
            } catch (e) {
                console.error('[api-proxy] Error:', e.message);
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: '请求格式错误: ' + e.message }));
            }
        });
        return;
    }

    // 处理 DashScope 视频生成代理 (POST 创建任务 / GET 查询任务)
    if (req.url.startsWith('/dashscope-proxy') && (req.method === 'POST' || req.method === 'GET')) {
        if (req.method === 'GET') {
            // 查询任务状态: /dashscope-proxy?task_id=xxx
            const urlObj = new URL(req.url, `http://localhost:${port}`);
            const taskId = urlObj.searchParams.get('task_id');
            const region = urlObj.searchParams.get('region') || 'beijing';
            const apiKey = CONFIG.VIDEO_KEY;

            if (!taskId) {
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Missing task_id' }));
                return;
            }

            const host = region === 'singapore' ? 'dashscope-intl.aliyuncs.com' : 'dashscope.aliyuncs.com';
            const https = require('https');
            const options = {
                hostname: host,
                port: 443,
                path: `/api/v1/tasks/${taskId}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            };

            let responded = false;
            const proxyReq = https.request(options, (proxyRes) => {
                let responseData = '';
                proxyRes.on('data', (chunk) => { responseData += chunk; });
                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(responseData);
                });
            });

            proxyReq.setTimeout(30000, () => {
                if (responded) return; responded = true;
                res.writeHead(504, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request timeout' }));
                proxyReq.destroy();
            });

            proxyReq.on('error', (e) => {
                if (responded) return; responded = true;
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            });

            proxyReq.end();
        } else {
            // 创建任务: POST body { url, data, region }
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const targetUrl = data.url;
                    const targetData = data.data;
                    const apiKey = CONFIG.VIDEO_KEY;
                    const region = data.region || 'beijing';

                    const host = region === 'singapore' ? 'dashscope-intl.aliyuncs.com' : 'dashscope.aliyuncs.com';
                    const urlObj = new URL(targetUrl);
                    const https = require('https');
                    const options = {
                        hostname: host,
                        port: 443,
                        path: urlObj.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                            'X-DashScope-Async': 'enable',
                            'Content-Length': Buffer.byteLength(JSON.stringify(targetData))
                        }
                    };

                    let responded = false;
                    const proxyReq = https.request(options, (proxyRes) => {
                        let responseData = '';
                        proxyRes.on('data', (chunk) => { responseData += chunk; });
                        proxyRes.on('end', () => {
                            res.writeHead(proxyRes.statusCode, {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            });
                            res.end(responseData);
                        });
                    });

                    proxyReq.setTimeout(60000, () => {
                        if (responded) return; responded = true;
                        res.writeHead(504, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Request timeout' }));
                        proxyReq.destroy();
                    });

                    proxyReq.on('error', (e) => {
                        if (responded) return; responded = true;
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: e.message }));
                    });

                    proxyReq.write(JSON.stringify(targetData));
                    proxyReq.end();
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                }
            });
        }
        return;
    }

    // 处理媒体文件上传 (视频/音频) - 保存到临时目录并返回可访问URL
    if (req.url === '/media-upload' && req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: '需要 multipart/form-data' }));
            return;
        }

        // 解析 boundary
        const boundaryMatch = contentType.match(/boundary=(.+)/);
        if (!boundaryMatch) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: '缺少 boundary' }));
            return;
        }
        const boundary = boundaryMatch[1];

        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const boundaryBuf = Buffer.from('--' + boundary);

                // 简单解析 multipart 数据
                let fileData = null;
                let fileName = 'upload';
                let fileType = 'video/mp4';

                const str = buffer.toString('binary');
                const parts = str.split('--' + boundary);

                for (const part of parts) {
                    if (part.includes('Content-Disposition')) {
                        const filenameMatch = part.match(/filename="(.+?)"/);
                        const nameMatch = part.match(/name="(.+?)"/);
                        const contentTypeMatch = part.match(/Content-Type:\s*(.+?)\r\n/);

                        if (filenameMatch) {
                            fileName = filenameMatch[1];
                            if (contentTypeMatch) fileType = contentTypeMatch[1].trim();

                            // 提取文件数据 (在两个 \r\n\r\n 之后)
                            const headerEnd = part.indexOf('\r\n\r\n');
                            if (headerEnd !== -1) {
                                const dataStart = headerEnd + 4;
                                const dataEnd = part.lastIndexOf('\r\n');
                                if (dataEnd > dataStart) {
                                    const raw = part.substring(dataStart, dataEnd);
                                    fileData = Buffer.from(raw, 'binary');
                                }
                            }
                        }
                    }
                }

                if (!fileData) {
                    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: '未找到文件数据' }));
                    return;
                }

                // 保存到临时目录
                const tempDir = path.join(__dirname, 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                const ext = path.extname(fileName) || (fileType.includes('video') ? '.mp4' : '.mp3');
                const savedName = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + ext;
                const savedPath = path.join(tempDir, savedName);

                fs.writeFileSync(savedPath, fileData);

                const url = `http://localhost:${port}/temp/${savedName}`;
                console.log('Media uploaded:', savedName, 'Size:', fileData.length);

                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ url: url, filename: savedName }));
            } catch (e) {
                console.error('Media upload error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // 处理临时文件访问
    if (req.url.startsWith('/temp/')) {
        const fileName = req.url.replace('/temp/', '');
        const filePath = path.join(__dirname, 'temp', fileName);
        if (fs.existsSync(filePath)) {
            const ext = path.extname(fileName).toLowerCase();
            const mimeMap = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
            const mime = mimeMap[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('File not found');
        }
        return;
    }

    // 处理 IMGBB 图片上传
    if (req.url === '/imgbb-upload' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const imageBase64 = data.image;
                if (!imageBase64) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '缺少 image 参数' }));
                    return;
                }

                // 去掉 data:image/...;base64, 前缀
                let b64 = imageBase64;
                if (b64.includes(',')) b64 = b64.split(',')[1];

                // 构建 IMGBB API 请求
                const postData = new URLSearchParams({ image: b64 }).toString();
                const https = require('https');
                const options = {
                    hostname: 'api.imgbb.com',
                    path: '/1/upload?key=7a5b8c3d2e1f4g6h9i0j',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };

                const imgbbReq = https.request(options, (imgbbRes) => {
                    let responseData = '';
                    imgbbRes.on('data', chunk => { responseData += chunk; });
                    imgbbRes.on('end', () => {
                        res.writeHead(imgbbRes.statusCode, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(responseData);
                    });
                });

                imgbbReq.setTimeout(30000, () => {
                    res.writeHead(504, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '上传超时' }));
                    imgbbReq.destroy();
                });

                imgbbReq.on('error', (e) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                });

                imgbbReq.write(postData);
                imgbbReq.end();
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '请求格式错误' }));
            }
        });
        return;
    }

    // 图片上传到 telegra.ph 获取公网 URL（供 i2i API 使用）
    if (req.url === '/upload-image' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                let b64 = data.image;
                if (!b64) {
                    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ success: false, error: '缺少 image 参数' }));
                    return;
                }
                // 去掉 data:image/...;base64, 前缀
                if (b64.includes(',')) b64 = b64.split(',')[1];
                const imgBuffer = Buffer.from(b64, 'base64');

                // 构建 multipart/form-data 上传到 telegra.ph
                const boundary = '----TelegraPhBoundary' + Date.now();
                const fileData = Buffer.concat([
                    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`),
                    imgBuffer,
                    Buffer.from(`\r\n--${boundary}--\r\n`)
                ]);

                const https = require('https');
                const options = {
                    hostname: 'telegra.ph',
                    path: '/upload',
                    method: 'POST',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': fileData.length
                    }
                };

                let responded = false;
                const uploadReq = https.request(options, (uploadRes) => {
                    let responseData = '';
                    uploadRes.on('data', chunk => { responseData += chunk; });
                    uploadRes.on('end', () => {
                        if (responded) return; responded = true;
                        try {
                            const result = JSON.parse(responseData);
                            if (result && result[0] && result[0].src) {
                                const url = 'https://telegra.ph' + result[0].src;
                                console.log('Image uploaded to telegra.ph:', url);
                                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                                res.end(JSON.stringify({ success: true, url: url }));
                            } else {
                                console.error('telegra.ph upload failed:', responseData);
                                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                                res.end(JSON.stringify({ success: false, error: '上传失败: ' + responseData }));
                            }
                        } catch (e) {
                            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                            res.end(JSON.stringify({ success: false, error: '解析响应失败' }));
                        }
                    });
                });

                uploadReq.setTimeout(30000, () => {
                    if (responded) return; responded = true;
                    res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ success: false, error: '上传超时' }));
                    uploadReq.destroy();
                });

                uploadReq.on('error', (e) => {
                    if (responded) return; responded = true;
                    console.error('telegra.ph upload error:', e);
                    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                });

                uploadReq.write(fileData);
                uploadReq.end();
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ success: false, error: '请求格式错误' }));
            }
        });
        return;
    }

    // 处理代理上传请求 (JSON -> multipart/form-data)
    if (req.url === '/proxy-upload' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const targetUrl = data.url;
                const apiKey = data.apiKey;
                const model = data.model;
                const prompt = data.prompt;
                const imageBase64 = data.image;
                const size = data.size;
                const n = data.n;

                console.log('Proxy upload request:');
                console.log('Target URL:', targetUrl);
                console.log('Model:', model);
                console.log('Prompt:', prompt ? prompt.substring(0, 50) : '');

                // 构建 multipart/form-data
                const boundary = '----FormBoundary' + Date.now();
                let bodyBuffer = Buffer.alloc(0);

                function addField(name, value) {
                    const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`);
                    const valBuf = Buffer.from(value);
                    const footer = Buffer.from('\r\n');
                    bodyBuffer = Buffer.concat([bodyBuffer, header, valBuf, footer]);
                }

                function addFile(name, filename, mimeType, fileBuffer) {
                    const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
                    const footer = Buffer.from('\r\n');
                    bodyBuffer = Buffer.concat([bodyBuffer, header, fileBuffer, footer]);
                }

                addField('model', model);
                addField('prompt', prompt);
                if (size) addField('size', size);
                if (n) addField('n', String(n));

                // 解码 base64 图片
                if (imageBase64) {
                    let b64 = imageBase64;
                    if (b64.includes(',')) b64 = b64.split(',')[1];
                    const imgBuffer = Buffer.from(b64, 'base64');
                    addFile('image', 'image.png', 'image/png', imgBuffer);
                }

                bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(`--${boundary}--\r\n`)]);

                const urlObj = new URL(targetUrl);
                const https = require('https');
                const options = {
                    hostname: urlObj.hostname,
                    port: 443,
                    path: urlObj.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Length': bodyBuffer.length
                    }
                };

                const proxyReq = https.request(options, (proxyRes) => {
                    let responseData = '';
                    proxyRes.on('data', chunk => { responseData += chunk; });
                    proxyRes.on('end', () => {
                        res.writeHead(proxyRes.statusCode, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                        });
                        res.end(responseData);
                    });
                });

                proxyReq.setTimeout(180000, () => {
                    res.writeHead(504, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Request timeout' }));
                    proxyReq.destroy();
                });

                proxyReq.on('error', (e) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                });

                proxyReq.write(bodyBuffer);
                proxyReq.end();
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request: ' + e.message }));
            }
        });
        return;
    }

    // 处理图片下载代理
    if (req.url.startsWith('/proxy-download') && req.method === 'GET') {
        const urlParams = new URL(req.url, 'http://localhost');
        const imageUrl = urlParams.searchParams.get('url');
        if (!imageUrl) {
            res.writeHead(400);
            res.end('Missing url parameter');
            return;
        }
        const https = require('https');
        https.get(imageUrl, (imgRes) => {
            res.writeHead(200, {
                'Content-Type': imgRes.headers['content-type'] || 'image/png',
                'Content-Disposition': 'attachment; filename="ktoonai-image.png"',
                'Access-Control-Allow-Origin': '*'
            });
            imgRes.pipe(res);
        }).on('error', () => {
            res.writeHead(500);
            res.end('Download failed');
        });
        return;
    }

    // 处理 CORS 预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    let filePath;
    // Decode URL to handle Chinese characters
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(req.url);
    } catch (e) {
        // If UTF-8 decoding fails, try GBK decoding
        try {
            // Replace percent-encoded characters with their actual bytes
            const urlWithBytes = req.url.replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
            });
            // Convert the URL string to a buffer using binary encoding
            const urlBuffer = Buffer.from(urlWithBytes, 'binary');
            decodedUrl = iconv.decode(urlBuffer, 'gbk');
        } catch (e2) {
            decodedUrl = req.url;
        }
    }

    // Remove query parameters from the URL for file path resolution
    const urlWithoutQuery = decodedUrl.split('?')[0];

    // Function to find file with Chinese characters in filename
    function findFileWithChineseChars(basePath, encodedUrl) {
        const dir = path.dirname(basePath);
        try { if (!fs.existsSync(dir)) return null; } catch(e) { return null; }
        let files;
        try { files = fs.readdirSync(dir); } catch(e) { return null; }
        const encodedFilename = path.basename(encodedUrl);

        for (const file of files) {
            const encodedFile = encodeURIComponent(file);
            if (encodedFile === encodedFilename || file === encodedFilename) {
                return path.join(dir, file);
            }
        }
        return null;
    }

    // 处理 converted-site 目录的文件
    if (urlWithoutQuery.startsWith('/converted-site/')) {
        const basePath = '..' + urlWithoutQuery;
        if (fs.existsSync(basePath)) {
            filePath = basePath;
        } else {
            // Try to find file with Chinese characters
            filePath = findFileWithChineseChars(basePath, urlWithoutQuery);
            if (!filePath) {
                filePath = basePath; // Fallback to original path
            }
        }
    } else if (urlWithoutQuery.startsWith('/ai-image-tool/')) {
        // Handle ai-image-tool directory files
        const basePath = '.' + urlWithoutQuery.replace('/ai-image-tool', '');
        if (fs.existsSync(basePath)) {
            filePath = basePath;
        } else {
            // Try to find file with Chinese characters
            filePath = findFileWithChineseChars(basePath, urlWithoutQuery);
            if (!filePath) {
                filePath = basePath; // Fallback to original path
            }
        }
    } else {
        // Check if file exists in ai-image-tool directory first
        const aiImageToolPath = '.' + urlWithoutQuery;
        if (fs.existsSync(aiImageToolPath)) {
            filePath = aiImageToolPath;
        } else {
            // Try to find file with Chinese characters
            filePath = findFileWithChineseChars(aiImageToolPath, urlWithoutQuery);
            if (!filePath) {
                // Default to converted-site directory
                const convertedPath = '../converted-site' + urlWithoutQuery;
                if (fs.existsSync(convertedPath)) {
                    filePath = convertedPath;
                } else {
                    // Try to find file with Chinese characters in converted-site
                    filePath = findFileWithChineseChars(convertedPath, urlWithoutQuery);
                    if (!filePath) {
                        filePath = convertedPath; // Fallback to original path
                    }
                }
            }
        }
    }

    // Handle root URL
    if (urlWithoutQuery === '/' || urlWithoutQuery === '') {
        filePath = '../converted-site/index-converted.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            console.log('Error reading file:', error);
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            const acceptEncoding = req.headers['accept-encoding'] || '';
            const compressibleTypes = ['text/html', 'text/css', 'application/javascript', 'application/json', 'image/svg+xml'];
            if (compressibleTypes.includes(contentType) && acceptEncoding.includes('gzip')) {
                zlib.gzip(content, (err, compressed) => {
                    if (err) {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(content);
                    } else {
                        res.writeHead(200, {
                            'Content-Type': contentType,
                            'Content-Encoding': 'gzip',
                            'Content-Length': compressed.length,
                            'Cache-Control': 'public, max-age=3600'
                        });
                        res.end(compressed);
                    }
                });
            } else {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': extname === '.html' ? 'no-cache' : 'public, max-age=86400'
                });
                res.end(content);
            }
        }
    });
});

server.listen(port, () => {
    console.log(`AI Image Tool Server running at http://localhost:${port}/`);
    console.log(`Open http://localhost:${port}/new-page.html in your browser`);
});