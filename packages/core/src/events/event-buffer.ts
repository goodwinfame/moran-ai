/**
 * EventBuffer — 环形缓冲区，为 SSE 断线重连提供 Last-Event-ID 回放
 *
 * 每个项目维护一个独立的事件缓冲区（最近 N 条），
 * 当客户端以 Last-Event-ID 重连时，可以重放缺失的事件。
 *
 * 事件 ID 格式：`{projectId}:{seq}`，全局递增。
 */

import type { SSEEvent } from "./types.js";

/** 带 ID 的缓冲事件 */
export interface BufferedEvent {
  /** 全局递增事件 ID */
  id: number;
  /** SSE 事件 */
  event: SSEEvent;
  /** 时间戳 */
  timestamp: number;
}

/** 每个项目的环形缓冲区 */
interface ProjectBuffer {
  events: BufferedEvent[];
  /** 下一个写入位置（ring buffer 指针） */
  writePos: number;
  /** 当前缓冲区已满？ */
  full: boolean;
}

export class EventBuffer {
  /** 全局递增序列号 */
  private seq = 0;

  /** 每个项目的缓冲区 */
  private buffers: Map<string, ProjectBuffer> = new Map();

  /** 每个项目缓冲多少条事件 */
  private readonly capacity: number;

  constructor(capacity = 200) {
    this.capacity = capacity;
  }

  /**
   * 将事件加入缓冲区，返回分配的事件 ID
   */
  push(projectId: string, event: SSEEvent): number {
    const id = ++this.seq;
    const buffered: BufferedEvent = { id, event, timestamp: Date.now() };

    let buf = this.buffers.get(projectId);
    if (!buf) {
      buf = {
        events: new Array<BufferedEvent>(this.capacity),
        writePos: 0,
        full: false,
      };
      this.buffers.set(projectId, buf);
    }

    buf.events[buf.writePos] = buffered;
    buf.writePos = (buf.writePos + 1) % this.capacity;
    if (buf.writePos === 0 && !buf.full) {
      buf.full = true;
    }

    return id;
  }

  /**
   * 获取 afterId 之后的所有缓冲事件
   *
   * @param projectId 项目 ID
   * @param afterId Last-Event-ID，返回此 ID 之后的事件
   * @returns 按 ID 递增排序的事件列表；如果 afterId 已被淘汰则返回 null（表示需要全量恢复）
   */
  getAfter(projectId: string, afterId: number): BufferedEvent[] | null {
    const buf = this.buffers.get(projectId);
    if (!buf) return [];

    // 收集缓冲区中的所有有效事件
    const allEvents: BufferedEvent[] = [];
    const count = buf.full ? this.capacity : buf.writePos;

    for (let i = 0; i < count; i++) {
      const idx = buf.full
        ? (buf.writePos + i) % this.capacity
        : i;
      const ev = buf.events[idx];
      if (ev) {
        allEvents.push(ev);
      }
    }

    // 按 ID 排序（应该已经是有序的，但保险起见）
    allEvents.sort((a, b) => a.id - b.id);

    // 检查 afterId 是否还在缓冲区范围内
    // 只有当缓冲区已满（发生过淘汰）时才需要检查
    if (buf.full && allEvents.length > 0) {
      const oldest = allEvents[0];
      if (oldest && afterId < oldest.id - 1) {
        // afterId 太旧，缓冲区已淘汰 —— 返回 null 表示无法回放
        return null;
      }
    }

    // 返回 afterId 之后的事件
    return allEvents.filter((e) => e.id > afterId);
  }

  /**
   * 获取当前最新的事件 ID（用于初始连接时告诉客户端起始点）
   */
  getLatestId(projectId: string): number {
    const buf = this.buffers.get(projectId);
    if (!buf) return 0;

    const count = buf.full ? this.capacity : buf.writePos;
    if (count === 0) return 0;

    // 最新的事件在 writePos - 1 位置
    const latestIdx = (buf.writePos - 1 + this.capacity) % this.capacity;
    const latest = buf.events[latestIdx];
    return latest ? latest.id : 0;
  }

  /**
   * 清理某个项目的缓冲区
   */
  clear(projectId: string): void {
    this.buffers.delete(projectId);
  }

  /**
   * 获取缓冲区中的事件数量
   */
  size(projectId: string): number {
    const buf = this.buffers.get(projectId);
    if (!buf) return 0;
    return buf.full ? this.capacity : buf.writePos;
  }

  /**
   * 销毁所有缓冲区
   */
  dispose(): void {
    this.buffers.clear();
    this.seq = 0;
  }
}
