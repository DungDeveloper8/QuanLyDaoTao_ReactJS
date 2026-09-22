import { useCallback, useEffect, useRef, useState } from 'react';

export default function useFetch(fetcher, deps = []) {
  const fetcherRef = useRef(fetcher);
  const requestIdRef = useRef(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  fetcherRef.current = fetcher;

  const execute = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');

    try {
      const result = await fetcherRef.current();
      if (requestId === requestIdRef.current) {
        setData(result);
      }
      return result;
    } catch (requestError) {
      if (requestId === requestIdRef.current) {
        setError(
          requestError?.response?.data?.message ||
            requestError?.message ||
            'Không thể tải dữ liệu.',
        );
      }
      throw requestError;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    execute().catch(() => {});

    return () => {
      requestIdRef.current += 1;
    };
  }, [execute]);

  return { data, setData, loading, error, reload: execute };
}
