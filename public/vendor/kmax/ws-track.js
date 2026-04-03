class WSTrack {
    /**
     * 创建一个客户端连接追踪服务并接收追踪数据
     * @param {String} host 主机域名或IP
     */
    constructor(host) {
        this.type = 'WSTrack';
        if (!host) host = 'localhost';
        this.url = `ws://${host}:42025`;
        this.ws = new WebSocket(this.url);
        this.ondata = undefined;
        
        const that = this;
        this.ws.addEventListener("open", function (event) {
            console.log("WebSocket connected.")
            // this.ws.send("Hello Server!");
            that.connect();
        });

        // Listen for messages
        this.ws.addEventListener("message", function (event) {
            // console.log("Message from server ", event.data);
            if (that.ondata && typeof that.ondata === 'function') {
                that.ondata(JSON.parse(event.data));
            }
        });
    }
    /**
     * 发送消息到追踪服务
     * @param {Number} cid 消息类型
     * @param {String} type 消息体类型
     * @param {Object} obj 消息体对象
     */
    send(cid, type, obj) {
        const data = {
            cid: cid,
            type: type,
            data: obj
        }
        console.log(JSON.stringify(data));
        this.ws.send(JSON.stringify(data));
    }
    /**
     * 发送连接消息
     */
    connect() {
        this.send(0, "ConnectCommand", {
            sdkMajor: 1,
            sdkMinor: 0,
            platform: 17,
            appId: 0,
            appName: document.title
        });
    }
    /**
     * 设置追踪状态及显示模式
     * @param {Number} s 追踪状态 -1，0，1
     * @param {Number} mode 显示模式 -1，0，1
     */
    setDisplayMode(s, mode) {
        this.send(1, "XRModeCommand", {
            tracking: s,
            displayMode: mode
        });
    }
    /**
     * 使操控笔震动
     * @param {Number} t 震动时长单位为毫秒
     * @param {Number} s 震动强度0-100
     */
    penShake(t, s) {
        this.send(2, "PenShakeCommand", {
            time: t,
            strength: s
        });
    }
}

export { WSTrack };