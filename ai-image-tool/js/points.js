// points.js - 积分管理系统
(function() {
    'use strict';

    var POINTS_KEY = 'ktoonai_points';
    var INIT_POINTS = 200;

    // 各功能扣费
    var COSTS = {
        'image': 1,      // 生图
        'video': 10,     // 视频
        'template': 2,   // 模板
        'product': 2     // 电商商品图
    };

    function getPoints() {
        var username = localStorage.getItem('ktoon_logged_in');
        if (!username) return 0;
        var allPoints = JSON.parse(localStorage.getItem(POINTS_KEY) || '{}');
        if (allPoints[username] === undefined) {
            allPoints[username] = INIT_POINTS;
            localStorage.setItem(POINTS_KEY, JSON.stringify(allPoints));
        }
        return allPoints[username];
    }

    function setPoints(amount) {
        var username = localStorage.getItem('ktoon_logged_in');
        if (!username) return;
        var allPoints = JSON.parse(localStorage.getItem(POINTS_KEY) || '{}');
        allPoints[username] = amount;
        localStorage.setItem(POINTS_KEY, JSON.stringify(allPoints));
    }

    function deduct(type) {
        var cost = COSTS[type] || 0;
        var current = getPoints();
        if (current < cost) {
            return { ok: false, remaining: current, cost: cost };
        }
        setPoints(current - cost);
        return { ok: true, remaining: current - cost, cost: cost };
    }

    function initPoints(username) {
        var allPoints = JSON.parse(localStorage.getItem(POINTS_KEY) || '{}');
        if (allPoints[username] === undefined) {
            allPoints[username] = INIT_POINTS;
            localStorage.setItem(POINTS_KEY, JSON.stringify(allPoints));
        }
    }

    function refund(type) {
        var cost = COSTS[type] || 0;
        if (cost <= 0) return;
        var current = getPoints();
        setPoints(current + cost);
    }

    // 暴露到全局
    window.KtoonPoints = {
        get: getPoints,
        set: setPoints,
        deduct: deduct,
        refund: refund,
        init: initPoints,
        COSTS: COSTS,
        INIT_POINTS: INIT_POINTS
    };
})();
