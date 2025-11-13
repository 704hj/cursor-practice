// src/api/news.ts
import { api } from "./client";
import { components } from "@/src/types/api";

type NewsList = components["schemas"]["NewsList"];
type NewsItem = components["schemas"]["NewsItem"];

/**
 * 뉴스 목록 조회
 */
export async function fetchNews() {
  const { data, error } = await api.GET("/news", {});
  
  if (error) {
    throw new Error(error.message || "뉴스 목록을 가져오는데 실패했습니다");
  }
  
  return data as NewsList;
}

/**
 * 특정 뉴스 항목 조회 (ID로)
 */
export async function fetchNewsItem(id: string) {
  // openapi.yaml에 단일 뉴스 조회 엔드포인트가 없으므로
  // 목록에서 찾는 방식으로 구현 (필요시 API 엔드포인트 추가 가능)
  const newsList = await fetchNews();
  const item = newsList?.items?.find((item) => item.id === id);
  
  if (!item) {
    throw new Error("뉴스 항목을 찾을 수 없습니다");
  }
  
  return item as NewsItem;
}

