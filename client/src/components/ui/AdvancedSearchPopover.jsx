import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from './Button';
import { AutocompleteInput } from './AutocompleteInput';

export function AdvancedSearchPopover({ currentParams, onApply, onClear }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Filter States
  const [extension, setExtension] = useState(currentParams.get('extension') || '');
  const [minSize, setMinSize] = useState(currentParams.get('minSize') || '');
  const [maxSize, setMaxSize] = useState(currentParams.get('maxSize') || '');
  const [startDate, setStartDate] = useState(currentParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(currentParams.get('endDate') || '');
  const [isTagged, setIsTagged] = useState(currentParams.get('isTagged') || '');
  
  // Autocomplete states
  const [tagSearch, setTagSearch] = useState(currentParams.get('tags') || '');
  const [deptSearch, setDeptSearch] = useState(currentParams.get('departmentOwner') || '');
  const [userSearch, setUserSearch] = useState(''); // Text input
  const [uploadedBy, setUploadedBy] = useState(currentParams.get('uploadedBy') || ''); // ID

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleApply = () => {
    const newParams = new URLSearchParams(currentParams);
    
    const updateParam = (key, value) => {
      if (value) newParams.set(key, value);
      else newParams.delete(key);
    };

    updateParam('extension', extension);
    updateParam('minSize', minSize);
    updateParam('maxSize', maxSize);
    updateParam('startDate', startDate);
    updateParam('endDate', endDate);
    updateParam('isTagged', isTagged);
    updateParam('tags', tagSearch);
    updateParam('departmentOwner', deptSearch);
    updateParam('uploadedBy', uploadedBy);

    onApply(newParams);
    setIsOpen(false);
  };

  const handleClear = () => {
    setExtension('');
    setMinSize('');
    setMaxSize('');
    setStartDate('');
    setEndDate('');
    setIsTagged('');
    setTagSearch('');
    setDeptSearch('');
    setUserSearch('');
    setUploadedBy('');
    onClear();
    setIsOpen(false);
  };

  const hasActiveFilters = [
    extension, minSize, maxSize, startDate, endDate, isTagged, tagSearch, deptSearch, uploadedBy
  ].some(Boolean);

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
          hasActiveFilters 
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}
        title="Advanced Filters"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden transform origin-top-right">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
            <h3 className="font-bold text-gray-900 dark:text-white">Advanced Search</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
            {/* File Type */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">File Type</label>
              <select value={extension} onChange={e => setExtension(e.target.value)} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                <option value="">Any type</option>
                <option value=".pdf">PDF Document (.pdf)</option>
                <option value=".docx">Word Document (.docx)</option>
                <option value=".xlsx">Excel Spreadsheet (.xlsx)</option>
                <option value=".png">Image (.png)</option>
                <option value=".jpg">Image (.jpg)</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">To</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
              </div>
            </div>

            {/* Size Range (Bytes) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Min Size (Bytes)</label>
                <input type="number" placeholder="e.g. 1048576 (1MB)" value={minSize} onChange={e => setMinSize(e.target.value)} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Max Size (Bytes)</label>
                <input type="number" placeholder="e.g. 5242880 (5MB)" value={maxSize} onChange={e => setMaxSize(e.target.value)} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
              </div>
            </div>

            {/* High-Cardinality: Tag */}
            <div className="relative z-30">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Has Tag</label>
              <AutocompleteInput
                endpoint="/api/documents/tags/search"
                itemKey="tags"
                labelAccessor="tag"
                placeholder="Search tags..."
                value={tagSearch}
                onChange={setTagSearch}
                onSelect={(item) => setTagSearch(item.tag)}
              />
            </div>

            {/* High-Cardinality: Uploaded By */}
            <div className="relative z-20">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Uploaded By</label>
              <AutocompleteInput
                endpoint="/api/auth/users/search"
                itemKey="users"
                labelAccessor="name"
                placeholder="Search users..."
                value={userSearch}
                onChange={setUserSearch}
                onSelect={(item) => {
                  setUserSearch(item.name);
                  setUploadedBy(item._id);
                }}
              />
              {uploadedBy && (
                <div className="mt-1 flex justify-end">
                  <button onClick={() => { setUploadedBy(''); setUserSearch(''); }} className="text-[10px] text-red-500 hover:underline">Clear User Filter</button>
                </div>
              )}
            </div>

            {/* High-Cardinality: Department */}
            <div className="relative z-10">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Department</label>
              <AutocompleteInput
                endpoint="/api/documents/departments/search"
                itemKey="departments"
                placeholder="Search departments..."
                value={deptSearch}
                onChange={setDeptSearch}
                onSelect={(item) => setDeptSearch(item)}
              />
            </div>

            {/* Tagged Boolean */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">AI Status</label>
              <select value={isTagged} onChange={e => setIsTagged(e.target.value)} className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                <option value="">Any Status</option>
                <option value="true">Successfully Tagged</option>
                <option value="false">Needs Tagging / Failed</option>
              </select>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-between items-center gap-3">
            <button
              onClick={handleClear}
              className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1"
            >
              Clear
            </button>
            <Button onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
