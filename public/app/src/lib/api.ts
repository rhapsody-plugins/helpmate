import api from './axios';

// Define a generic type for request parameters
type RequestParams = Record<string, string | number | boolean>;

// Define a generic type for request data
type RequestData = Record<string, unknown>;

// Example API service functions
export const apiService = {
  // GET request example
  get: async <T>(endpoint: string, params?: RequestParams) => {
    const response = await api.get<T>(endpoint, { params });
    return response.data;
  },

  // POST request example
  post: async <T>(endpoint: string, data?: RequestData) => {
    const response = await api.post<T>(endpoint, data);
    return response.data;
  },

  // PUT request example
  put: async <T>(endpoint: string, data?: RequestData) => {
    const response = await api.put<T>(endpoint, data);
    return response.data;
  },

  // DELETE request example
  delete: async <T>(endpoint: string) => {
    const response = await api.delete<T>(endpoint);
    return response.data;
  },
};

export default apiService;