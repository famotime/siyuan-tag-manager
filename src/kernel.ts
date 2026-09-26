import type * as kernel from "siyuan/kernel"

/**
 * 思源笔记内核插件（Kernel Plugin）示例实现。
 * 运行于思源 Go 内核的 Goja JavaScript 运行时中。
 *
 * 生命周期：
 * ready → loading → loaded → running → stopping → stopped
 *          ↓onload           ↓onrunning           ↓onunload
 */
class KernelPlugin {
  private readonly siyuan: kernel.ISiyuan = (globalThis as unknown as { siyuan: kernel.ISiyuan }).siyuan
  private ws: kernel.IWebSocket | null = null
  private es: kernel.IEventSource | null = null

  constructor() {
    // 绑定生命周期钩子
    this.siyuan.plugin.lifecycle.onload = this.onload.bind(this)
    this.siyuan.plugin.lifecycle.onrunning = this.onrunning.bind(this)
    this.siyuan.plugin.lifecycle.onunload = this.onunload.bind(this)

    // 绑定内核入站事件处理器
    this.siyuan.event.handler = this.eventHandler.bind(this)

    // 绑定私有作用域服务端路由处理器 (/plugin/private/<name>/*)
    this.siyuan.server.private.http.handler = this.httpHandler.bind(this)
    this.siyuan.server.private.ws.handler = this.wsHandler.bind(this)
    this.siyuan.server.private.es.handler = this.esHandler.bind(this)
  }

  /**
   * 插件初始化入口：注册 RPC 方法、Agent 能力、初始化存储监听等。
   */
  async onload(): Promise<void> {
    const {
      rpc,
      agent,
      storage,
      logger,
      plugin,
    } = this.siyuan
    await logger.info("onload: kernel plugin name =", plugin.name, "version =", plugin.version)

    // 1. 注册 RPC 方法
    await rpc.bind("echo", async (...args: any[]) => {
      await logger.debug("RPC method [echo] called with:", args)
      return args
    }, "Returns all received arguments unchanged.")

    await rpc.bind("echo-notify", async (...args: any[]) => {
      await logger.debug("RPC method [echo-notify] called with:", args)
      await rpc.broadcast("notify", args)
      return args
    }, "Broadcasts the received arguments to all connected clients.")

    // 2. 注册智能体能力 (Agent Capability，替代旧版实验性 MCP Tools)
    await agent.registerCapability(
      "echo",
      {
        title: "Echo or Log Message",
        description: "Echoes a message back or writes it to the kernel log with declared effects",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["echo", "log"],
              description: "The action to perform: echo directly or write to kernel log",
            },
            message: {
              type: "string",
              description: "The text payload",
            },
          },
          required: ["action", "message"],
        },
        outputSchema: {
          type: "object",
          properties: {
            action: { type: "string" },
            message: { type: "string" },
          },
          required: ["action", "message"],
        },
        actionEffects: {
          echo: {},
          log: {
            localWrite: true,
          },
        },
      },
      async (input: Record<string, any>) => {
        const result = {
          action: input.action,
          message: String(input.message),
        }
        if (input.action === "log") {
          await logger.info("Agent capability [echo] logged message:", result.message)
        }
        return result
      },
    )

    // 3. 存储监听（可选）
    try {
      await storage.watcher.add("./")
    } catch {
      // 静默处理首次目录未生成情况
    }
  }

  /**
   * 插件进入 running 状态：此时内核网络与前端通道均已就绪。
   */
  async onrunning(): Promise<void> {
    const { logger } = this.siyuan
    await logger.info("onrunning: kernel plugin is now active and running")
  }

  /**
   * 插件卸载与资源释放：需保持幂等与轻量。
   */
  async onunload(): Promise<void> {
    const {
      rpc,
      agent,
      logger,
    } = this.siyuan
    try {
      await agent.unregisterCapability("echo")
      await rpc.unbind("echo")
      await rpc.unbind("echo-notify")
    } catch (e) {
      console.error("Error during kernel plugin teardown:", e)
    }
    await logger.info("onunload: kernel plugin cleanup completed")
  }

  /**
   * 内核广播与总线事件处理。
   */
  async eventHandler(event: kernel.TEventMessage): Promise<void> {
    const {
      event: siyuanEvent,
      logger,
    } = this.siyuan
    await logger.debug("kernel event received:", event)
    if (event.type === "fs-notify") {
      await logger.info("storage file changed:", (event as kernel.IFsNotifyEventMessage).detail)
    }
    await siyuanEvent.emit("plugin", {
      id: event.id,
      type: "echo",
      detail: event,
    })
  }

  /**
   * 私有 HTTP 服务端处理 (/plugin/private/<name>/*)。
   */
  async httpHandler(req: kernel.IServerRequest): Promise<kernel.IHttpResponse> {
    return {
      statusCode: 200,
      headers: {
        "X-Plugin": [this.siyuan.plugin.name],
        "Content-Type": ["application/json; charset=utf-8"],
      },
      body: {
        data: {
          type: "JSON",
          data: {
            plugin: this.siyuan.plugin.name,
            path: req.url.path,
            method: req.request.method,
            query: req.url.query,
            timestamp: Date.now(),
          },
        },
      },
    }
  }

  /**
   * 私有 WebSocket 服务端处理 (/plugin/private/<name>/*)。
   */
  async wsHandler(req: kernel.IServerWebSocketRequest): Promise<void> {
    req.port.onopen = async () => {
      await req.port.send(JSON.stringify({ msg: "Connected to kernel plugin WebSocket server" }))
    }
    req.port.onmessage = async (e) => {
      if (typeof e.data === "string") {
        await req.port.send(JSON.stringify({
          echo: e.data,
          time: Date.now(),
        }))
      }
    }
  }

  /**
   * 私有 SSE (Server-Sent Events) 服务端处理 (/plugin/private/<name>/*)。
   */
  async esHandler(req: kernel.IServerEventSourceRequest): Promise<void> {
    req.port.onopen = async () => {
      const now = Date.now()
      req.port.send({
        id: now.toString(),
        event: "connected",
        data: JSON.stringify({
          ts: now,
          plugin: this.siyuan.plugin.name,
        }),
        retry: 5000,
      })
    }
  }
}

// eslint-disable-next-line no-new
new KernelPlugin()

