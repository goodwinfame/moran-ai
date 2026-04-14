"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { ReviewIssueData } from "@/components/review/issue-list";
import type { ReviewRoundData } from "@/components/review/review-report";
import type { ReviewSummary } from "@/components/review/chapter-review-selector";

/**
 * Full chapter review data from API
 */
interface ChapterReviewResponse {
  id: string;
  projectId: string;
  chapterNumber: number;
  chapterTitle: string | null;
  rounds: ReviewRoundData[];
  status: string;
  latestScore: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ReviewListResponse {
  reviews: ChapterReviewResponse[];
  total: number;
}

/**
 * Hook for fetching review list for a project.
 */
export function useReviews(projectId: string | null) {
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!projectId) {
      setReviews([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ReviewListResponse>(
        `/api/projects/${projectId}/reviews`,
      );
      const summaries: ReviewSummary[] = data.reviews.map((r) => ({
        chapterNumber: r.chapterNumber,
        chapterTitle: r.chapterTitle,
        status: r.status,
        latestScore: r.latestScore,
        roundCount: r.rounds.length,
      }));
      setReviews(summaries);
      setTotal(data.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载审校列表失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  return { reviews, total, loading, error, refetch: fetchReviews };
}

/**
 * Hook for fetching a single chapter's review details.
 */
export function useReviewDetail(projectId: string | null, chapterNumber: number | null) {
  const [review, setReview] = useState<ChapterReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReview = useCallback(async () => {
    if (!projectId || chapterNumber === null) {
      setReview(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ChapterReviewResponse>(
        `/api/projects/${projectId}/reviews/${chapterNumber}`,
      );
      setReview(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载审校详情失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, chapterNumber]);

  useEffect(() => {
    void fetchReview();
  }, [fetchReview]);

  /** Trigger a new review round */
  const triggerReview = useCallback(async () => {
    if (!projectId || chapterNumber === null) return;
    try {
      const data = await api.post<ChapterReviewResponse>(
        `/api/projects/${projectId}/reviews/${chapterNumber}`,
      );
      setReview(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "触发审校失败";
      setError(msg);
    }
  }, [projectId, chapterNumber]);

  /** Force-pass a review */
  const forcePass = useCallback(async () => {
    if (!projectId || chapterNumber === null) return;
    try {
      await api.post(`/api/projects/${projectId}/reviews/${chapterNumber}/force-pass`);
      // Refetch to get updated status
      await fetchReview();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "强制通过失败";
      setError(msg);
    }
  }, [projectId, chapterNumber, fetchReview]);

  /** Update a verdict */
  const updateVerdict = useCallback(async (issueId: string, verdict: ReviewIssueData["verdict"]) => {
    if (!projectId || chapterNumber === null) return;
    try {
      await api.put(`/api/projects/${projectId}/reviews/${chapterNumber}/issues/${issueId}/verdict`, { verdict });
      // Update local state
      if (review) {
        const updated = { ...review };
        updated.rounds = updated.rounds.map((round) => ({
          ...round,
          issues: round.issues.map((issue) =>
            issue.id === issueId ? { ...issue, verdict } : issue,
          ),
        }));
        setReview(updated);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "更新裁决失败";
      setError(msg);
    }
  }, [projectId, chapterNumber, review]);

  return { review, loading, error, refetch: fetchReview, triggerReview, forcePass, updateVerdict };
}
