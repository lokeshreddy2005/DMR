import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { SlidersHorizontal, X, Search, Calendar, HardDrive, Tag, User, FilterX } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

const FILTER_KEYS = ['extension', 'minSize', 'maxSize', 'startDate', 'endDate', 'isTagged', 'tags', 'uploadedBy', 'academicYear', 'departmentOwner', 'permissionLevel'];

export default function AdvancedSearchPopover({ activeSpace, isPublicOnly }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);
  const { token } = useAuth();

  // ── Form State ──────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    extension:       searchParams.get('extension') || '',
    minSize:         searchParams.get('minSize') || '',
    maxSize:         searchParams.get('maxSize') || '',
    startDate:       searchParams.get('startDate') || '',
    endDate:         searchParams.get('endDate') || '',
    isTagged:        searchParams.get('isTagged') || '',
    tags:            searchParams.get('tags') || '',
    academicYear:    searchParams.get('academicYear') || '',
    departmentOwner: searchParams.get('departmentOwner') || '',
    permissionLevel: searchParams.get('permissionLevel') || '',
  });

  // Tags autocomplete
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [isTagging, setIsTagging] = useState(false);

  // Multi-select users: array of { _id, name }
  const [selectedUsers, setSelectedUsers] = useState(() => {
    const ids = searchParams.get('uploadedBy');
    // We only have IDs from URL on mount — names will be blank; they'll be shown on next open
    return ids ? ids.split(',').filter(Boolean).map(id => ({ _id: id, name: id })) : [];
  });
  const [userInput, setUserInput] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [isUserSearch, setIsUserSearch] = useState(false);

  // Whether any filter is active (to show badge on trigger)
  const hasActiveFilters = FILTER_KEYS.some(k => searchParams.get(k));

  // ── Apply ──────────────────────────────────────────────────────────────────
  const applyFilters = () => {
    const newParams = new URLSearchParams(searchParams);

    // Flush any still-typed tagInput
    const finalTags = (() => {
      const current = filters.tags ? filters.tags.split(',').filter(Boolean) : [];
      if (tagInput.trim() && !current.includes(tagInput.trim())) current.push(tagInput.trim());
      return current.join(',');
    })();

    const finalFilters = { ...filters, tags: finalTags };

    FILTER_KEYS.forEach(key => {
      let val = finalFilters[key];
      // Convert MB → bytes for size fields
      if (key === 'minSize' && val) val = String(Math.round(parseFloat(val) * 1024 * 1024));
      if (key === 'maxSize' && val) val = String(Math.round(parseFloat(val) * 1024 * 1024));
      if (val) newParams.set(key, val);
      else newParams.delete(key);
    });

    // Encode selected users as comma-separated IDs
    const userIds = selectedUsers.map(u => u._id).join(',');
    if (userIds) newParams.set('uploadedBy', userIds);
    else newParams.delete('uploadedBy');

    newParams.set('page', '1');
    setSearchParams(newParams);
    setTagInput('');
    setIsOpen(false);
  };

  // ── Clear ──────────────────────────────────────────────────────────────────
  const clearFilters = () => {
    setFilters({ extension: '', minSize: '', maxSize: '', startDate: '', endDate: '', isTagged: '', tags: '', academicYear: '', departmentOwner: '', permissionLevel: '' });
    setTagInput('');
    setUserInput('');
    setSelectedUsers([]);

    const newParams = new URLSearchParams(searchParams);
    [...FILTER_KEYS, 'uploadedBy'].forEach(k => newParams.delete(k));
    newParams.set('page', '1');
    setSearchParams(newParams); // triggers fetchDocuments via useEffect in Workspace
  };

  // ── Click outside ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Tag autocomplete ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!tagInput || tagInput.length < 1) { setTagSuggestions([]); return; }
    const fetchTags = async () => {
      setIsTagging(true);
      try {
        if (isPublicOnly || activeSpace === 'public') {
          const res = await axios.get(`${API_URL}/api/public/documents/tags`);
          // Filter locally but preserve original casing from backend
          const filtered = (res.data.tags || []).filter(t => t.tag.toLowerCase().includes(tagInput.toLowerCase())).slice(0, 10);
          setTagSuggestions(filtered);
        } else {
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await axios.get(`${API_URL}/api/documents/tags/search?q=${encodeURIComponent(tagInput)}`, { headers });
          setTagSuggestions(res.data.tags || []);
        }
      } catch (err) {
        console.error('Tag suggestion error:', err);
      } finally { setIsTagging(false); }
    };
    const t = setTimeout(fetchTags, 300);
    return () => clearTimeout(t);
  }, [tagInput, activeSpace, isPublicOnly, token]);

  // ── User autocomplete ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userInput || userInput.length < 2 || !token) { setUserSuggestions([]); return; }
    const fetchUsers = async () => {
      setIsUserSearch(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${API_URL}/api/documents/users/search?q=${encodeURIComponent(userInput)}`, { headers });
        setUserSuggestions(res.data.users || []);
      } catch (err) {
        console.error('User suggestion error:', err);
      } finally { setIsUserSearch(false); }
    };
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [userInput, token]);

  const addTag = (tag) => {
    const current = filters.tags ? filters.tags.split(',').filter(Boolean) : [];
    if (!current.includes(tag)) setFilters(f => ({ ...f, tags: [...current, tag].join(',') }));
    setTagInput('');
    setTagSuggestions([]);
  };

  const removeTag = (tag) => {
    setFilters(f => ({ ...f, tags: f.tags.split(',').filter(t => t !== tag).join(',') }));
  };

  const addUser = (user) => {
    if (!selectedUsers.find(u => u._id === user._id)) {
      setSelectedUsers(prev => [...prev, { _id: user._id, name: user.name }]);
    }
    setUserInput('');
    setUserSuggestions([]);
  };

  const removeUser = (id) => setSelectedUsers(prev => prev.filter(u => u._id !== id));

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button — shows orange dot when filters active */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-colors ${
          hasActiveFilters
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
            : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
        }`}
        title={hasActiveFilters ? 'Filters active — click to edit' : 'Advanced Filters'}
      >
        <SlidersHorizontal className="w-5 h-5" />
        {hasActiveFilters && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
        )}
      </button>

      {/* Clear-all icon — visible when filters are active, outside popover */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="absolute -top-1 -left-7 p-1.5 text-orange-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Clear all filters"
        >
          <FilterX className="w-4 h-4" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-[360px] md:w-[480px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                Advanced Filters
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[65vh] space-y-5">

              {/* File Type & Tag Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">File Type</label>
                  <select
                    value={filters.extension}
                    onChange={e => setFilters(f => ({ ...f, extension: e.target.value }))}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  >
                    <option value="">Any type</option>
                    <option value=".pdf">PDF (.pdf)</option>
                    <option value=".docx">Word (.docx)</option>
                    <option value=".xlsx">Excel (.xlsx)</option>
                    <option value=".pptx">PowerPoint (.pptx)</option>
                    <option value=".txt">Text (.txt)</option>
                    <option value=".png">Image (.png)</option>
                    <option value=".jpg">Image (.jpg)</option>
                    <option value=".jpeg">Image (.jpeg)</option>
                    <option value=".zip">Archive (.zip)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tag Status</label>
                  <select
                    value={filters.isTagged}
                    onChange={e => setFilters(f => ({ ...f, isTagged: e.target.value }))}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  >
                    <option value="">Any</option>
                    <option value="true">AI Tagged</option>
                    <option value="false">Untagged</option>
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date Range</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
                  <span className="text-gray-400 text-sm font-medium">to</span>
                  <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
                </div>
              </div>

              {/* Size Range */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> Size (MB)</label>
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Min (e.g. 0.5)" step="0.1" min="0" value={filters.minSize} onChange={e => setFilters(f => ({ ...f, minSize: e.target.value }))} className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                  <span className="text-gray-400 text-sm font-medium">–</span>
                  <input type="number" placeholder="Max (e.g. 10)" step="0.1" min="0" value={filters.maxSize} onChange={e => setFilters(f => ({ ...f, maxSize: e.target.value }))} className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Has Tag</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Type to search tags..."
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); addTag(tagInput.trim()); } }}
                      className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                    {isTagging && <span className="absolute right-2 top-2.5 text-xs text-gray-400">...</span>}
                    {tagSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {tagSuggestions.map(s => (
                          <div key={s.tag} onMouseDown={e => { e.preventDefault(); addTag(s.tag); }} className="p-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-gray-800 dark:text-gray-200">
                            {s.tag}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="secondary" onClick={() => tagInput.trim() && addTag(tagInput.trim())} className="shrink-0 text-sm py-1.5 px-3 h-auto">Add</Button>
                </div>
                {filters.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {filters.tags.split(',').filter(Boolean).map(t => (
                      <span key={t} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-md border border-blue-200 dark:border-blue-700 flex items-center gap-1">
                        {t}
                        <button type="button" onMouseDown={() => removeTag(t)}><X className="w-3 h-3 hover:text-red-500" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Uploaded By — multi-select, shows names */}
              {activeSpace !== 'private' && (
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><User className="w-3.5 h-3.5" /> Uploaded By</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={token ? "Search by name or email..." : "Login to filter by user"}
                      disabled={!token}
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      className="w-full pl-8 text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                    {isUserSearch && <span className="absolute right-2 top-2.5 text-xs text-gray-400">...</span>}
                    {userSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {userSuggestions.map(u => {
                          const already = selectedUsers.some(s => s._id === u._id);
                          return (
                            <div
                              key={u._id}
                              onMouseDown={e => { e.preventDefault(); if (!already) addUser(u); }}
                              className={`p-2.5 text-sm flex items-center gap-2.5 transition-colors ${already ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer'}`}
                            >
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: u.avatarColor || '#3b82f6' }}>
                                {u.name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
                                <p className="text-xs text-gray-400 truncate">{u.email}</p>
                              </div>
                              {already && <span className="ml-auto text-[10px] text-gray-400 font-bold">ADDED</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedUsers.map(u => (
                        <span key={u._id} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs rounded-md border border-indigo-200 dark:border-indigo-700 flex items-center gap-1 max-w-[180px]">
                          <span className="truncate">{u.name}</span>
                          <button type="button" onMouseDown={() => removeUser(u._id)}><X className="w-3 h-3 hover:text-red-500 flex-shrink-0" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Academic Year & Department */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Academic Year</label>
                  <input type="text" placeholder="e.g. 2023-2024" value={filters.academicYear} onChange={e => setFilters(f => ({ ...f, academicYear: e.target.value }))} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Department</label>
                  <input type="text" placeholder="e.g. Computer Science" value={filters.departmentOwner} onChange={e => setFilters(f => ({ ...f, departmentOwner: e.target.value }))} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
              </div>

              {/* Permission level (shared/org only) */}
              {(activeSpace === 'shared' || activeSpace === 'organization') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Permission Role</label>
                  <select value={filters.permissionLevel} onChange={e => setFilters(f => ({ ...f, permissionLevel: e.target.value }))} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                    <option value="">Any Role</option>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
              )}

            </div>

            {/* Footer */}
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
