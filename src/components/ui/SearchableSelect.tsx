'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchableSelectProps<T> {
  id?: string;
  value: string;
  onChange: (value: string, item?: T) => void;
  options: T[];
  getOptionValue: (item: T) => string;
  getOptionLabel: (item: T) => string;
  placeholder?: string;
  searchPlaceholder?: string;
  filterOption?: (item: T, query: string) => boolean;
  renderOption?: (item: T, isSelected: boolean) => React.ReactNode;
  renderSelected?: (item: T) => React.ReactNode;
  noResultsMessage?: string | React.ReactNode;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
  required?: boolean;
}

export function SearchableSelect<T>({
  id,
  value,
  onChange,
  options,
  getOptionValue,
  getOptionLabel,
  placeholder = '-- Choose an option --',
  searchPlaceholder = 'Type to search records...',
  filterOption,
  renderOption,
  renderSelected,
  noResultsMessage = 'No matching records found.',
  allowClear = true,
  disabled = false,
  className = '',
  dropdownClassName = '',
  required = false,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();
  const selectId = id || uniqueId;

  // Selected item
  const selectedItem = options.find((opt) => getOptionValue(opt) === value);

  // Filtered options based on search query
  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    if (filterOption) {
      return filterOption(opt, searchQuery.trim().toLowerCase());
    }
    const label = getOptionLabel(opt).toLowerCase();
    return label.includes(searchQuery.trim().toLowerCase());
  });

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-select-item]');
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (item: T) => {
    const val = getOptionValue(item);
    onChange(val, item);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input to support native form validation if required */}
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
          value={value}
          required={required}
          onChange={() => {}}
        />
      )}

      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer select-none min-h-[44px] ${
          isOpen
            ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/20 shadow-xs'
            : 'border-slate-300 bg-slate-50/80 hover:bg-white hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
      >
        <div className="flex-1 min-w-0">
          {selectedItem ? (
            renderSelected ? (
              renderSelected(selectedItem)
            ) : (
              <span className="text-xs font-semibold text-slate-900 truncate block">
                {getOptionLabel(selectedItem)}
              </span>
            )
          ) : (
            <span className="text-xs text-slate-400 truncate block">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {allowClear && selectedItem && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e as any);
                }
              }}
              title="Clear selection"
              className="p-1 rounded-full hover:bg-slate-200/80 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-80 animate-in fade-in-50 zoom-in-95 duration-150 ${dropdownClassName}`}
        >
          {/* Search Input Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-slate-400">
              <span>
                {filteredOptions.length} of {options.length} records matching
              </span>
              {searchQuery && (
                <span className="font-mono text-emerald-600 font-medium">Filtering by &quot;{searchQuery}&quot;</span>
              )}
            </div>
          </div>

          {/* Options List */}
          <div ref={listRef} role="listbox" className="overflow-y-auto overscroll-contain flex-1 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">No matching records found</div>
                <div className="text-[11px] text-slate-400">
                  {typeof noResultsMessage === 'string'
                    ? noResultsMessage
                    : noResultsMessage}
                </div>
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const optVal = getOptionValue(opt);
                const isSelected = optVal === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={optVal}
                    data-select-item
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2.5 text-xs transition cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50/90 text-emerald-950 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {renderOption ? renderOption(opt, isSelected) : (
                        <div className="truncate">{getOptionLabel(opt)}</div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

