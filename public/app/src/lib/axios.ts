import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${
    window.helpmateApiSettings?.site_url || window.location.origin
  }/?rest_route=/helpmate/v1`, // WordPress REST API base URL
  headers: {
    'Content-Type': 'application/json',
    'X-WP-Nonce': window.helpmateApiSettings?.nonce || '', // WordPress nonce for authentication
  },
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // You can modify the request config here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle errors here
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network Error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
