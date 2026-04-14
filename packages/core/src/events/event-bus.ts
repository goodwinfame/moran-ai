/**
 * EventBus — 进程内事件总线
 *
 * 按项目 ID 分发 SSE 事件，支持全事件订阅和按类型订阅。
 * 每个 SSE 连接订阅一个 projectId 的事件流。
 */

import { createLogger } from "../logger/index.js";
import type { SSEEvent, SSEEventData, SSEListener, Unsubscribe } from "./types.js";

export class EventBus {
  private channels: Map<string, Set<SSEListener>> = new Map();
  private logger = createLogger("event-bus");

  /**
   * 订阅某个项目的所有 SSE 事件
   * @returns 取消订阅函数
   */
  subscribe(projectId: string, listener: SSEListener): Unsubscribe {
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
    const wrapper: SSEListener = (event) => {
      if (event.type === type) {
        listener(event.data as SSEEventData<T>);
      }
    };
    return this.subscribe(projectId, wrapper);
  }

  /**
   * 发布一个事件到指定项目的所有监听器
   */
  emit(projectId: string, event: SSEEvent): void {
    const listeners = this.channels.get(projectId);
    if (!listeners || listeners.size === 0) return;

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        this.logger.error({ err, projectId, eventType: event.type }, "SSE listener threw an error");
      }
    }
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
   * 销毁事件总线，清理所有监听器
   */
  dispose(): void {
    this.channels.clear();
  }
}
