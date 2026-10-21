import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

export function useApiResource(endpoint, deps = []) {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get(endpoint);
      setData(result.data || []);
      setMeta(result.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, meta, loading, error, reload: load };
}
