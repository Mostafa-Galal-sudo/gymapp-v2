import { useEffect, useState } from "react";
import { foodRepository } from "../food/repository";
import type { Food } from "../food/model";
export function useFoodSearch(query: string, userId: string, revision = 0) {
  const [foods, setFoods] = useState<Food[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await foodRepository.search(query, userId);
        if (alive) setFoods(result.foods);
        if (result.refresh) {
          const fresh = await result.refresh;
          if (alive) setFoods(fresh);
        }
      } catch (e) {
        if (alive) setError(String((e as Error).message));
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, userId, revision]);
  return { foods, loading, error };
}
