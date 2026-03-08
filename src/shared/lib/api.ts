// Simple API client implementation - uses centralized apiClient
import { apiClient } from "@/utils/apiClient";

export const api = {
  get: async (endpoint: string) => {
    const response = await apiClient(endpoint);
    return response.json();
  },

  post: async (endpoint: string, data: any) => {
    const response = await apiClient(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  put: async (endpoint: string, data: any) => {
    const response = await apiClient(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  delete: async (endpoint: string) => {
    const response = await apiClient(endpoint, {
      method: "DELETE",
    });
    return response.json();
  },
};

export default api;
