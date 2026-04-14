"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MessageSquare, ThumbsDown, Heart, User, Star } from "lucide-react";

// ── Types ──────────────────────────────────────────

export interface BoringSpotData {
  quote: string;
  reason: string;
}

export interface TouchingMomentData {
  quote: string;
  feeling: string;
}

export interface FavoriteCharacterData {
  name: string;
  reason: string;
}

export interface ReaderFeedbackData {
  chapterNumber: number;
  readabilityScore: number;
  oneLiner: string;
  boringSpots: BoringSpotData[];
  touchingMoments: TouchingMomentData[];
  favoriteCharacter: FavoriteCharacterData | null;
  freeThoughts: string;
}

interface ReaderFeedbackProps {
  data: ReaderFeedbackData;
}

// ── Score color helper ──────────────────────────────

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600 border-green-300";
  if (score >= 6) return "text-amber-600 border-amber-300";
  return "text-red-600 border-red-300";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-green-50 dark:bg-green-950/20";
  if (score >= 6) return "bg-amber-50 dark:bg-amber-950/20";
  return "bg-red-50 dark:bg-red-950/20";
}

// ── Component ──────────────────────────────────────

/**
 * 书虫读者反馈卡片 — 以普通读者视角呈现章节阅读体验
 */
export function ReaderFeedback({ data }: ReaderFeedbackProps) {
  const { chapterNumber, readabilityScore, oneLiner, boringSpots, touchingMoments, favoriteCharacter, freeThoughts } = data;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          第{chapterNumber}章 · 读者反馈
        </h3>
        <Badge variant="outline" className={cn("text-sm font-bold", scoreColor(readabilityScore))}>
          {readabilityScore}/10
        </Badge>
      </div>

      {/* One-liner */}
      <div className={cn("rounded-lg p-3", scoreBg(readabilityScore))}>
        <p className="text-sm italic">&ldquo;{oneLiner}&rdquo;</p>
      </div>

      <Separator />

      {/* Boring spots */}
      {boringSpots.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-600">
            <ThumbsDown className="h-3.5 w-3.5" />
            读不下去的地方 ({boringSpots.length})
          </h4>
          <div className="space-y-2">
            {boringSpots.map((spot, i) => (
              <div key={`boring-${i}`} className="rounded-md border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 p-3">
                <p className="text-xs text-muted-foreground mb-1">原文：</p>
                <blockquote className="text-sm border-l-2 border-red-300 pl-2 mb-2 italic">
                  {spot.quote}
                </blockquote>
                <p className="text-sm text-red-700 dark:text-red-300">{spot.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Touching moments */}
      {touchingMoments.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <Heart className="h-3.5 w-3.5" />
            打动我的瞬间 ({touchingMoments.length})
          </h4>
          <div className="space-y-2">
            {touchingMoments.map((moment, i) => (
              <div key={`touching-${i}`} className="rounded-md border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10 p-3">
                <blockquote className="text-sm border-l-2 border-emerald-300 pl-2 mb-2 italic">
                  {moment.quote}
                </blockquote>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{moment.feeling}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favorite character */}
      {favoriteCharacter && (
        <>
          <Separator />
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 p-1.5">
              <User className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">最喜欢的角色：{favoriteCharacter.name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{favoriteCharacter.reason}</p>
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Free thoughts */}
      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          自由感想
        </h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{freeThoughts}</p>
      </div>
    </div>
  );
}
