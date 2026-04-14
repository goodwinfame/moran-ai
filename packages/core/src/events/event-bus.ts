/**
 * EventBus — 进程内事件总线
 *
 * 按项目 ID 分发 SSE 事件，支持全事件订阅和按类型订阅。
 * 每个 SSE 连接订阅一个 projectId 的事件流。
 *
 * M3.6: 集成 EventBuffer，为每个发射的事件分配递增 ID，支持断线重连回放。
 */

import { createLogger } from "../logger/index.js";
import { EventBuffer } from "./event-buffer.js";
import type { SSEEvent, SSEEventData, SSEListener, Unsubscribe } from "./types.js";

/** 带 ID 的事件回调 */
export type SSEListenerWithId = (event: SSEEvent, eventId: number) => void;

export class EventBus {
  private channels: Map<string, Set<SSEListenerWithId>> = new Map();
  private logger = createLogger("event-bus");

  /** 事件缓冲区 — 用于断线重连回放 */
  readonly buffer: EventBuffer;

  constructor(bufferCapacity = 200) {
    this.buffer = new EventBuffer(bufferCapacity);
  }

  /**
   * 订阅某个项目的所有 SSE 事件
   * @returns 取消订阅函数
   */
  subscribe(projectId: string, listener: SSEListener): Unsubscribe {
    const wrapper: SSEListenerWithId = (event) => listener(event);
    return this.subscribeWithId(projectId, wrapper);
  }

  /**
   * 订阅某个项目的所有 SSE 事件（含事件 ID）
   * @returns 取消订阅函数
   */
  subscribeWithId(projectId: string, listener: SSEListenerWithId): Unsubscribe {
    let listeners = this.channels.get(projectId);
    if (!listeners) {
      listeners = new Set();
      this.channels.set(projectId, listeners);
    }
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.channels.delete(projectId);
      }
    };
  }

  /**
   * 订阅某个项目的特定类型事件
   * @returns 取消订阅函数
   */
  subscribeType<T extends SSEEvent["type"]>(
    projectId: string,
    type: T,
    listener: (data: SSEEventData<T>) => void,
  ): Unsubscribe {
    const wrapper: SSEListenerWithId = (event) => {
      if (event.type === type) {
        listener(event.data as SSEEventData<T>);
      }
    };
    return this.subscribeWithId(projectId, wrapper);
  }

  /**
   * 发布一个事件到指定项目的所有监听器
   * 事件会自动入缓冲区并分配递增 ID
   */
  emit(projectId: string, event: SSEEvent): number {
    // 缓冲事件并获取 ID
    const eventId = this.buffer.push(projectId, event);

    const listeners = this.channels.get(projectId);
    if (!listeners || listeners.size === 0) return eventId;

    for (const listener of listeners) {
      try {
        listener(event, eventId);
      } catch (err) {
        this.logger.error({ err, projectId, eventType: event.type }, "SSE listener threw an error");
      }
    }

    return eventId;
  }

  /**
   * 获取指定项目的订阅者数量
   */
  subscriberCount(projectId: string): number {
    return this.channels.get(projectId)?.size ?? 0;
  }

  /**
   * 移除指定项目的所有监听器
   */
  removeAll(projectId: string): void {
    this.channels.delete(projectId);
  }

  /**
   * 销毁事件总线，清理所有监听器和缓冲区
   */
  dispose(): void {
    this.channels.clear();
    this.buffer.dispose();
  }
}
