/**
 * useApi Hook
 *
 * Provides a convenient way to make API calls with loading and error states.
 */

import { useState, useCallback } from 'react';
import { handleApiError } from '../utils/errors';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      return result;
    } catch (err) {
      const formattedError = handleApiError(err);
      setError(formattedError);
      throw formattedError;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { loading, error, execute, reset };
}

export default useApi;
