// API configuration - works in both development and production
// For Vercel: Set VITE_API_URL in Vercel dashboard Environment Variables
// For local: Use .env.production or .env.development
const API_URL = 
  import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? 'https://dmr-d3no.onrender.com'  // Production Render backend
    : 'http://localhost:5000');        // Local development

console.log('🔗 API Base URL:', API_URL);

export default API_URL;
