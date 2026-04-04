import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_URL from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { Search, Loader2 } from 'lucide-react';

export function AutocompleteInput({ 
  value, 
  onChange, 
  onSelect,
  endpoint, 
  itemKey, 
  labelAccessor,
  placeholder = "Search..."
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef(null);
  const { token } = useAuth();

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const t = token || localStorage.getItem('dmr_token');
        const headers = t ? { Authorization: `Bearer ${t}` } : {};
        const res = await axios.get(`${API_URL}${endpoint}?q=${encodeURIComponent(value)}`, { headers });
        const items = res.data[itemKey] || [];
        setSuggestions(items);
        setIsOpen(items.length > 0);
      } catch (err) {
        console.error('Autocomplete search failed', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, endpoint, itemKey, token]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          className="w-full pl-9 pr-10 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 dark:text-gray-200"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((item, idx) => (
            <li
              key={item._id || item.tag || idx}
              onClick={() => {
                onSelect(item);
                setIsOpen(false);
              }}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
            >
              {labelAccessor ? item[labelAccessor] : item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
