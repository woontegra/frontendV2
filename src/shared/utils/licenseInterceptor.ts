/**
 * Global License Interceptor
 * Monitors all fetch responses for NO_LICENSE status
 * Automatically redirects to license activation page
 */

let isRedirecting = false;

export const setupLicenseInterceptor = () => {
  // Store original fetch
  const originalFetch = window.fetch;

  // Override fetch
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      
      // Check for NO_LICENSE response
      if (response.status === 403) {
        const clonedResponse = response.clone();
        
        try {
          const data = await clonedResponse.json();
          
          if (data.status === "NO_LICENSE") {
            console.warn("[License Interceptor] NO_LICENSE detected - redirecting to activation page");
            
            // Prevent multiple redirects
            if (!isRedirecting) {
              isRedirecting = true;
              
              // Check if already on license activation page
              if (!window.location.pathname.includes("/license-activation")) {
                window.location.href = "/license-activation";
              }
            }
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  console.log("✅ License interceptor enabled");
};

// Reset redirect flag when user navigates to license activation
export const resetLicenseRedirect = () => {
  isRedirecting = false;
};

