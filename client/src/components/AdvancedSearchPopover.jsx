import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { SlidersHorizontal, X, ChevronDown, Check, Search, Calendar, HardDrive, Tag, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdvancedSearchPopover({ activeSpace, isPublicOnly }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);
  const { token } = useAuth();
  
  // Form State
  const [filters, setFilters] = useState({
    extension: searchParams.get('extension') || '',
    minSize: searchParams.get('minSize') || '',
    maxSize: searchParams.get('maxSize') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    isTagged: searchParams.get('isTagged') || '',
    tags: searchParams.get('tags') || '',
    uploadedBy: searchParams.get('uploadedBy') || ''
  });

  // Autocomplete State
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [isTagging, setIsTagging] = useState(false);

  const [userInput, setUserInput] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [isUserSearch, setIsUserSearch] = useState(false);

  // Sync state to URL when applied
  const applyFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        newParams.set(key, filters[key]);
      } else {
        newParams.delete(key);
      }
    });

    // Reset pagination to page 1 on new filter
    newParams.set('page', '1');
    setSearchParams(newParams);
    setIsOpen(false);
  };

  const clearFilters = () => {
    setFilters({
      extension: '', minSize: '', maxSize: '', startDate: '', endDate: '', isTagged: '', tags: '', uploadedBy: ''
    });
    setTagInput('');
    setUserInput('');
    
    const newParams = new URLSearchParams(searchParams);
    ['extension', 'minSize', 'maxSize', 'startDate', 'endDate', 'isTagged', 'tags', 'uploadedBy'].forEach(key => newParams.delete(key));
    setSearchParams(newParams);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tag Autocomplete
  useEffect(() => {
    if (!tagInput || tagInput.length < 1) {
      setTagSuggestions([]);
      return;
    }
    const fetchTags = async () => {
      setIsTagging(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // Use authenticated tag search if available, fallback to public if public only
        if (isPublicOnly || activeSpace === 'public') {
           // We might not have a search endpoint for public tags, so we could fetch all and filter, or just use auth if possible. Wait, the backend has /api/public/documents/tags
           const res = await axios.get(`${API_URL}/api/public/documents/tags`);
           const filtered = res.data.tags.filter(t => t.tag.toLowerCase().includes(tagInput.toLowerCase())).slice(0,10);
           setTagSuggestions(filtered);
        } else {
           const res = await axios.get(`${API_URL}/api/documents/tags/search?q=${tagInput}`, { headers });
           setTagSuggestions(res.data.tags || []);
        }
      } catch (err) {
        console.error('Failed to fetch tag suggestions', err);
      } finally { setIsTagging(false); }
    };
    const timer = setTimeout(fetchTags, 300);
    return () => clearTimeout(timer);
  }, [tagInput, activeSpace, isPublicOnly, token]);

  // User Autocomplete
  useEffect(() => {
    if (!userInput || userInput.length < 2 || isPublicOnly || activeSpace === 'public') {
      setUserSuggestions([]);
      return;
    }
    const fetchUsers = async () => {
      setIsUserSearch(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_URL}/api/documents/users/search?q=${userInput}`, { headers });
        setUserSuggestions(res.data.users || []);
      } catch (err) {
        console.error('Failed to fetch user suggestions', err);
      } finally { setIsUserSearch(false); }
    };
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [userInput, activeSpace, isPublicOnly, token]);


  return (
    <div className="relative" ref={popoverRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
        title="Advanced Search"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-[360px] md:w-[480px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                Advanced Filters
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-6">
              
              {/* Type & Tagged Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">File Type</label>
                  <select 
                    value={filters.extension} 
                    onChange={e => setFilters({...filters, extension: e.target.value})}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any type</option>
                    <option value=".pdf">PDF</option>
                    <option value=".docx">Word (.docx)</option>
                    <option value=".xlsx">Excel (.xlsx)</option>
                    <option value=".png">Image (.png)</option>
                    <option value=".jpg">Image (.jpg)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tag Status</label>
                  <select 
                    value={filters.isTagged} 
                    onChange={e => setFilters({...filters, isTagged: e.target.value})}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any</option>
                    <option value="true">Tagged</option>
                    <option value="false">Untagged</option>
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> Date Range</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={filters.startDate}
                    onChange={e => setFilters({...filters, startDate: e.target.value})}
                    className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                  <span className="text-gray-400">-</span>
                  <input 
                    type="date" 
                    value={filters.endDate}
                    onChange={e => setFilters({...filters, endDate: e.target.value})}
                    className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>

              {/* Size Range */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><HardDrive className="w-3.5 h-3.5"/> Size (Bytes)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    placeholder="Min size"
                    value={filters.minSize}
                    onChange={e => setFilters({...filters, minSize: e.target.value})}
                    className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                  <span className="text-gray-400">-</span>
                  <input 
                    type="number" 
                    placeholder="Max size"
                    value={filters.maxSize}
                    onChange={e => setFilters({...filters, maxSize: e.target.value})}
                    className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>

              {/* Tags Autocomplete */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Tag className="w-3.5 h-3.5"/> Has Tag</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      placeholder="Search tags..."
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                    {tagSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                        {tagSuggestions.map(s => (
                          <div 
                            key={s.tag} 
                            onClick={() => { 
                              const currentTags = filters.tags ? filters.tags.split(',') : [];
                              if (!currentTags.includes(s.tag)) {
                                setFilters({...filters, tags: [...currentTags, s.tag].join(',')});
                              }
                              setTagInput(''); 
                              setTagSuggestions([]); 
                            }}
                            className="p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          >
                            {s.tag}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="secondary" onClick={() => {
                      if(tagInput.trim()) {
                          const currentTags = filters.tags ? filters.tags.split(',') : [];
                          if (!currentTags.includes(tagInput.trim())) {
                              setFilters({...filters, tags: [...currentTags, tagInput.trim()].join(',')});
                          }
                          setTagInput('');
                      }
                  }} className="shrink-0 text-sm py-1.5 px-3 h-auto">Add</Button>
                </div>
                {filters.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {filters.tags.split(',').map(t => (
                      <span key={t} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs rounded-md border border-blue-200 flex items-center gap-1">
                        {t} <button onClick={() => setFilters({...filters, tags: filters.tags.split(',').filter(x => x !== t).join(',')})}><X className="w-3 h-3 hover:text-red-500"/></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Uploaded By Autocomplete - only for authenticated views */}
              {(!isPublicOnly && activeSpace !== 'public') && (
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><User className="w-3.5 h-3.5"/> Uploaded By</label>
                  <input 
                    type="text" 
                    placeholder={filters.uploadedBy ? `User ID: ${filters.uploadedBy}` : "Search user by name/email..."}
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                  {userSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {userSuggestions.map(u => (
                        <div 
                          key={u._id} 
                          onClick={() => { setFilters({...filters, uploadedBy: u._id}); setUserInput(''); setUserSuggestions([]); }}
                          className="p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white ${u.avatarColor || 'bg-blue-500'}`}>
                            {u.name.charAt(0)}
                          </div>
                          <span>{u.name} <span className="text-gray-400 text-xs">({u.email})</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                  {filters.uploadedBy && (
                    <div className="mt-2 text-xs flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 w-max px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                      Selected User ID: <span className="font-mono text-gray-500">{filters.uploadedBy}</span>
                      <button onClick={() => setFilters({...filters, uploadedBy: ''})}><X className="w-3 h-3 hover:text-red-500"/></button>
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex gap-3">
              <Button onClick={clearFilters} variant="secondary" className="flex-1 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Clear All
              </Button>
              <Button onClick={applyFilters} className="flex-1 shadow-md bg-blue-600 hover:bg-blue-700 border-none">
                Apply Filters
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
