"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchNews, fetchNewsItem } from "@/src/api/news";
import { components } from "@/src/types/api";

type NewsList = components["schemas"]["NewsList"];
type NewsItem = components["schemas"]["NewsItem"];

/**
 * 뉴스 목록 조회 훅
 */
export function useFetchNews() {
  return useQuery<NewsList>({
    queryKey: ["news", "list"],
    queryFn: fetchNews,
  });
}

/**
 * 특정 뉴스 항목 조회 훅
 */
export function useNewsItem(id: string) {
  return useQuery<NewsItem>({
    queryKey: ["news", "item", id],
    queryFn: () => fetchNewsItem(id),
    enabled: !!id, // id가 있을 때만 실행
  });
}

