export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      
      // Handle API requests
      if (url.pathname.startsWith('/api/')) {
        // Forward to your backend
        const backendUrl = 'http://your-backend-url:8080';
        const newUrl = new URL(url.pathname + url.search, backendUrl);
        
        return fetch(newUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
      }
  
      // Serve static files for the frontend
      return env.ASSETS.fetch(request);
    }
  };