import axios from 'axios';

const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes

export const api = {
    get: async (url, config = {}) => {
        // Bypass cache if signal is aborted or specifically requested
        if (config.signal?.aborted) {
            throw new axios.Cancel('Request canceled');
        }

        const key = url + JSON.stringify(config.params || {});
        
        if (!config.bypassCache && cache.has(key)) {
            const { data, timestamp } = cache.get(key);
            if (Date.now() - timestamp < TTL) {
                // Return a mocked Axios response
                return { data, status: 200, statusText: 'OK', headers: {}, config, cached: true };
            } else {
                cache.delete(key);
            }
        }

        const res = await axios.get(url, config);
        cache.set(key, { data: res.data, timestamp: Date.now() });
        return res;
    },
    post: async (...args) => {
        const res = await axios.post(...args);
        api.clearCache();
        return res;
    },
    put: async (...args) => {
        const res = await axios.put(...args);
        api.clearCache();
        return res;
    },
    delete: async (...args) => {
        const res = await axios.delete(...args);
        api.clearCache();
        return res;
    },
    clearCache: () => {
        cache.clear();
    },
    isCancel: axios.isCancel
};

export default api;
