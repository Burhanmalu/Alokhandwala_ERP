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
        className={`w-full text-left px-3 py-2 rounded-md border flex items-center justify-between gap-2.5 transition cursor-pointer select-none min-h-[40px] text-xs ${
          isOpen
            ? 'border-[#6e482f] bg-white ring-2 ring-[#8c5e39]/20 shadow-xs'
            : 'border-[#d8c8b4] bg-[#fbf9f5]/60 hover:bg-white hover:border-[#8c5e39]'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {!selectedItem && (
            <Search className="w-3.5 h-3.5 text-[#9c826e] shrink-0" />
          )}
          {selectedItem ? (
            renderSelected ? (
              renderSelected(selectedItem)
            ) : (
              <span className="text-xs font-semibold text-[#24160c] truncate block">
                {getOptionLabel(selectedItem)}
              </span>
            )
          ) : (
            <span className="text-xs text-[#9c826e] truncate block">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[#9c826e]">
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
              className="p-0.5 rounded hover:bg-[#ebdcc9] hover:text-[#24160c] transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#6e482f]' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-md border border-[#ebdcc9] shadow-lg overflow-hidden flex flex-col max-h-80 animate-in fade-in-50 duration-100 ${dropdownClassName}`}
        >
          {/* Search Input Bar */}
          <div className="p-2 border-b border-[#f2eadf] bg-[#fbf9f5] shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9c826e] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#d8c8b4] rounded focus:outline-none focus:ring-1 focus:ring-[#8c5e39] focus:border-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
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
            <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-[#7d6553]">
              <span>
                {filteredOptions.length} of {options.length} records matching
              </span>
              {searchQuery && (
                <span className="font-mono text-[#6e482f] font-semibold">Filtering by &quot;{searchQuery}&quot;</span>
              )}
            </div>
          </div>

          {/* Options List */}
          <div ref={listRef} role="listbox" className="overflow-y-auto overscroll-contain flex-1 divide-y divide-[#f5efe6]">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#7d6553] space-y-1">
                <div className="font-semibold text-[#24160c]">No matching records found</div>
                <div className="text-[11px] text-[#9c826e]">
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
                    className={`px-3 py-2 text-xs transition cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#fbf9f4] text-[#24160c] font-semibold border-l-2 border-[#c79e7c]'
                        : isHighlighted
                        ? 'bg-[#faf6ee] text-[#24160c]'
                        : 'text-[#4a3424] hover:bg-[#faf6ee]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {renderOption ? renderOption(opt, isSelected) : (
                        <div className="truncate">{getOptionLabel(opt)}</div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#6e482f] shrink-0" />
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

