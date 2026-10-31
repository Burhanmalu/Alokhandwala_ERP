'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  ImageIcon, 
  UploadCloud, 
  Trash2, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Maximize2, 
  Loader2, 
  Plus, 
  Download,
  Link as LinkIcon,
  Check
} from 'lucide-react';
import { processAndUploadImage } from '@/lib/image-utils';

export interface ImageUploaderWithLightboxProps {
  images: string[];
  onChange: (images: string[]) => void;
  title?: string;
  subtitle?: string;
  maxFiles?: number;
  disabled?: boolean;
  accentColor?: 'emerald' | 'blue' | 'amber';
}

export function ImageUploaderWithLightbox({
  images = [],
  onChange,
  title = 'Site & Engineering Photographs',
  subtitle = 'Take live site camera photos or upload multiple images directly from your device gallery.',
  maxFiles = 20,
  disabled = false,
  accentColor = 'emerald',
}: ImageUploaderWithLightboxProps) {
  // Lightbox State
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  // Custom URL input
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [customUrl, setCustomUrl] = useState<string>('');

  // Refs for file inputs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIndexRef = useRef<number | null>(null);

  // Upload handler for multiple files
  const handleUploadFiles = async (files: FileList | File[]) => {
    if (disabled) return;
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) return;

    setIsUploading(true);
    setUploadProgressText(`Uploading ${valid.length} image${valid.length > 1 ? 's' : ''}...`);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < valid.length; i++) {
        setUploadProgressText(`Uploading ${i + 1} of ${valid.length}: ${valid[i].name}...`);
        const url = await processAndUploadImage(valid[i]);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      // Append new URLs while filtering duplicates
      const updated = [...images];
      for (const u of uploadedUrls) {
        if (!updated.includes(u) && updated.length < maxFiles) {
          updated.push(u);
        }
      }
      onChange(updated);
    } catch (err) {
      console.error('Error uploading images:', err);
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      // Reset inputs so user can pick same file again if desired
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Replace single image at specific index
  const handleTriggerReplace = (index: number) => {
    if (disabled) return;
    replaceTargetIndexRef.current = index;
    replaceInputRef.current?.click();
  };

  const handleExecuteReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const targetIdx = replaceTargetIndexRef.current;
    if (!files || files.length === 0 || targetIdx === null) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    setIsUploading(true);
    setUploadProgressText(`Replacing photo #${targetIdx + 1}...`);
    try {
      const newUrl = await processAndUploadImage(file);
      if (newUrl) {
        const updated = [...images];
        updated[targetIdx] = newUrl;
        onChange(updated);
      }
    } catch (err) {
      console.error('Error replacing image:', err);
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      replaceTargetIndexRef.current = null;
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  // Remove photo
  const handleRemovePhoto = (index: number) => {
    if (disabled) return;
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);

    if (activeLightboxIndex !== null) {
      if (updated.length === 0) {
        setActiveLightboxIndex(null);
      } else if (activeLightboxIndex >= updated.length) {
        setActiveLightboxIndex(updated.length - 1);
      }
    }
  };

  // Add custom URL
  const handleAddCustomUrl = () => {
    let url = customUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:') && !url.startsWith('/')) {
      url = `https://${url}`;
    }
    if (!images.includes(url) && images.length < maxFiles) {
      onChange([...images, url]);
    }
    setCustomUrl('');
    setShowUrlInput(false);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Lightbox Zoom and Navigation
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  const handlePrevImage = useCallback(() => {
    if (activeLightboxIndex === null || images.length <= 1) return;
    setActiveLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : images.length - 1));
    setZoomLevel(1);
  }, [activeLightboxIndex, images.length]);

  const handleNextImage = useCallback(() => {
    if (activeLightboxIndex === null || images.length <= 1) return;
    setActiveLightboxIndex((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : 0));
    setZoomLevel(1);
  }, [activeLightboxIndex, images.length]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (activeLightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setActiveLightboxIndex(null);
          setZoomLevel(1);
          break;
        case 'ArrowLeft':
          handlePrevImage();
          break;
        case 'ArrowRight':
          handleNextImage();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          handleResetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxIndex, handlePrevImage, handleNextImage, handleZoomIn, handleZoomOut, handleResetZoom]);

  return (
    <div className="space-y-4">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ebdcc9] pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#24160c] flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#8c5e39]" />
            <span>{title}</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#fbf9f5] border border-[#e8decb] text-[#574830]">
              {images.length} / {maxFiles} Files
            </span>
          </h3>
          {subtitle && <p className="text-xs text-[#7d6553] mt-0.5">{subtitle}</p>}
        </div>

        {/* Upload Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {/* 1. Camera Capture Button */}
          <button
            type="button"
            disabled={disabled || isUploading || images.length >= maxFiles}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24150c] hover:bg-[#382315] text-[#fdfbf7] rounded-md text-xs font-medium border border-[#4d301c] shadow-2xs transition disabled:opacity-50 cursor-pointer"
            title="Open camera to capture photos"
          >
            <Camera className="w-3.5 h-3.5 text-[#c79e7c]" />
            <span>Take Photo</span>
          </button>

          {/* 2. Gallery Upload Button (Device Gallery / Multiple) */}
          <button
            type="button"
            disabled={disabled || isUploading || images.length >= maxFiles}
            onClick={() => galleryInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6e482f] hover:bg-[#59371d] text-white rounded-md text-xs font-medium shadow-2xs transition disabled:opacity-50 cursor-pointer"
            title="Upload one or multiple photos from device photo gallery"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#debfa6]" />
            <span>Upload from Gallery</span>
          </button>

          {/* 3. URL Toggle */}
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-[#faf6ee] text-[#4d301c] rounded-md text-xs font-medium border border-[#d8c8b4] transition cursor-pointer"
            title="Paste image URL"
          >
            <LinkIcon className="w-3.5 h-3.5 text-[#9c826e]" />
            <span>URL</span>
          </button>
        </div>
      </div>

      {/* Hidden File Inputs */}
      {/* Gallery Input (Multiple, no capture attribute -> opens device gallery / file picker) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
      />

      {/* Camera Input (Camera capture on mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
      />

      {/* Replace Single Image Input */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleExecuteReplace}
      />

      {/* Optional URL Input Panel */}
      {showUrlInput && (
        <div className="p-2.5 bg-[#fbf9f5] border border-[#ebdcc9] rounded-md flex items-center gap-2 animate-in fade-in-50 duration-150">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomUrl())}
            placeholder="Paste image URL or cloud photo link..."
            className="flex-1 text-xs px-3 py-1.5 bg-white border border-[#d8c8b4] rounded focus:outline-none focus:ring-1 focus:ring-[#8c5e39] font-mono text-[#24160c]"
          />
          <button
            type="button"
            onClick={handleAddCustomUrl}
            className="px-3 py-1.5 bg-[#24150c] text-white rounded text-xs font-medium hover:bg-[#382315] transition cursor-pointer"
          >
            Add URL
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(false)}
            className="p-1 text-[#9c826e] hover:text-[#24160c] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="p-2.5 bg-[#faf6ee] border border-[#d8c8b4] rounded-md flex items-center gap-2.5 text-xs text-[#59371d] font-medium animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-[#8c5e39] shrink-0" />
          <span>{uploadProgressText || 'Processing & uploading image...'}</span>
        </div>
      )}

      {/* Upload Drop Zone & Thumbnails Grid */}
      {images.length === 0 ? (
        /* Empty State: Unified Clean Drag & Drop Upload Zone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => galleryInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-10 flex flex-col items-center justify-center text-center transition cursor-pointer select-none ${
            isDragging
              ? 'border-[#8c5e39] bg-[#faf6ee]'
              : 'border-[#ebdcc9] bg-[#fbf9f5] hover:border-[#8c5e39] hover:bg-[#faf6ee]/70'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-[#f2eadf] border border-[#d8c8b4] flex items-center justify-center text-[#8c5e39] mb-3 transition">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-[#24160c] mb-1">
            Drag & drop site photos here, or browse files
          </h4>
          <p className="text-xs text-[#7d6553] max-w-md mb-4">
            Capture live site photos or select multiple images directly from your device gallery.
          </p>
          <div className="flex items-center gap-2.5 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#24150c] hover:bg-[#382315] text-[#fdfbf7] rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-[#c79e7c]" />
              <span>Take Photo</span>
            </button>
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6e482f] hover:bg-[#59371d] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4 text-[#debfa6]" />
              <span>Choose from Gallery</span>
            </button>
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#fbf9f5] text-[#4d301c] rounded-lg text-xs font-semibold border border-[#d8c8b4] transition cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5 text-[#9c826e]" />
              <span>Paste URL</span>
            </button>
          </div>
          <span className="text-[10px] text-[#9c826e] mt-3 font-mono">
            Supports multiple JPEG, PNG, WEBP • Up to {maxFiles} photos
          </span>
        </div>
      ) : (
        /* Populated State: Responsive Grid with Thumbnails + Add More Card */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              onClick={() => {
                setActiveLightboxIndex(idx);
                setZoomLevel(1);
              }}
              className="group relative aspect-video rounded-lg overflow-hidden border border-[#d8c8b4] bg-[#19100a] shadow-2xs hover:border-[#8c5e39] transition cursor-pointer select-none"
              title="Click to open interactive preview and zoom"
            >
              {/* Thumbnail Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 opacity-90 group-hover:opacity-100"
              />

              {/* Click to Enlarge Overlay Indicator */}
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
                <span className="p-1.5 bg-black/75 rounded text-white shadow flex items-center gap-1.5 text-xs font-medium">
                  <Maximize2 className="w-3.5 h-3.5 text-[#c79e7c]" />
                  <span>Enlarge</span>
                </span>
              </div>

              {/* Badge: Photo Number */}
              <div className="absolute bottom-1.5 left-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[10px] text-white font-mono flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-[#c79e7c]" />
                <span>#${idx + 1}</span>
              </div>

              {/* Top Action Buttons (Replace & Remove) */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerReplace(idx);
                  }}
                  className="p-1 bg-black/75 hover:bg-black text-white rounded transition shadow-sm hover:text-[#c79e7c] cursor-pointer"
                  title="Replace with new photo"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePhoto(idx);
                  }}
                  className="p-1 bg-rose-700 hover:bg-rose-800 text-white rounded shadow-sm transition cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Add More Photos Card in Grid */}
          {images.length < maxFiles && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => galleryInputRef.current?.click()}
              className={`aspect-video rounded-lg border-2 border-dashed p-3 flex flex-col items-center justify-center text-center transition cursor-pointer select-none ${
                isDragging
                  ? 'border-[#8c5e39] bg-[#faf6ee]'
                  : 'border-[#d8c8b4] hover:border-[#8c5e39] bg-[#faf6ee]/50 hover:bg-[#faf6ee]'
              }`}
            >
              <UploadCloud
                className={`w-5 h-5 mb-1 transition ${
                  isDragging ? 'text-[#8c5e39] scale-110' : 'text-[#9c826e]'
                }`}
              />
              <div className="text-[11px] font-bold text-[#4d301c]">+ Add More Photos</div>
              <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={disabled || isUploading}
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-2 py-0.5 bg-white border border-[#d8c8b4] text-[#4d301c] rounded text-[10px] font-semibold hover:border-[#8c5e39] transition shadow-2xs cursor-pointer"
                >
                  Gallery
                </button>
                <span className="text-[9px] text-[#9c826e]">•</span>
                <button
                  type="button"
                  disabled={disabled || isUploading}
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-2 py-0.5 bg-white border border-[#d8c8b4] text-[#4d301c] rounded text-[10px] font-semibold hover:border-[#8c5e39] transition shadow-2xs cursor-pointer"
                >
                  Camera
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* INTERACTIVE LIGHTBOX MODAL WITH ZOOM & NAVIGATION       */}
      {/* ======================================================== */}
      {activeLightboxIndex !== null && images[activeLightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in-50 duration-150"
          onClick={() => setActiveLightboxIndex(null)}
        >
          {/* Top Bar: Controls & Info */}
          <div
            className="p-3 sm:p-4 bg-black/60 border-b border-white/10 flex items-center justify-between text-white shrink-0 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#24150c] text-[#fdf8f4] font-mono text-xs border border-[#4d301c]">
                Photo {activeLightboxIndex + 1} of {images.length}
              </span>
              <span className="hidden sm:inline text-xs text-[#debfa6]">
                Interactive High-Resolution Inspection
              </span>
            </div>

            {/* Quick Zoom Actions & Close */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 transition disabled:opacity-40 cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
                <span className="hidden sm:inline">Zoom Out</span>
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[#fdf8f4] font-mono text-xs transition cursor-pointer"
                title="Reset Zoom (0)"
              >
                {Math.round(zoomLevel * 100)}%
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3.5}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 transition disabled:opacity-40 cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
                <span className="hidden sm:inline">Zoom In</span>
              </button>

              <div className="h-4 w-px bg-white/20 mx-1"></div>

              {/* Replace Active Photo */}
              <button
                type="button"
                onClick={() => handleTriggerReplace(activeLightboxIndex)}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 transition cursor-pointer"
                title="Replace this photograph"
              >
                <RefreshCw className="w-4 h-4 text-[#c79e7c]" />
                <span className="hidden sm:inline">Replace</span>
              </button>

              {/* Remove Active Photo */}
              <button
                type="button"
                onClick={() => handleRemovePhoto(activeLightboxIndex)}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-rose-700/80 hover:bg-rose-700 text-white text-xs flex items-center gap-1 transition cursor-pointer"
                title="Delete this photograph"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Remove</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setActiveLightboxIndex(null)}
                className="p-1.5 sm:p-2 rounded bg-white/10 hover:bg-white/20 text-white transition ml-1 cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Image Canvas with Previous / Next Arrows */}
          <div
            className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden p-2 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Arrow */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 shadow-xl transition hover:scale-105 active:scale-95"
                title="Previous photo (Left Arrow)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Displayed Image */}
            <div className="w-full h-full flex items-center justify-center overflow-auto cursor-grab active:cursor-grabbing">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[activeLightboxIndex]}
                alt={`Photo ${activeLightboxIndex + 1}`}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
                draggable={false}
              />
            </div>

            {/* Next Arrow */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handleNextImage}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 shadow-xl transition hover:scale-105 active:scale-95"
                title="Next photo (Right Arrow)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Carousel Strip */}
          <div
            className="p-3 bg-black/70 border-t border-white/10 shrink-0 z-20 flex items-center justify-center gap-2 overflow-x-auto max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {images.map((url, idx) => (
              <button
                key={`thumb-${idx}`}
                type="button"
                onClick={() => {
                  setActiveLightboxIndex(idx);
                  setZoomLevel(1);
                }}
                className={`relative w-14 h-10 sm:w-16 sm:h-12 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                  idx === activeLightboxIndex
                    ? 'border-emerald-500 ring-2 ring-emerald-400/50 scale-105'
                    : 'border-white/30 hover:border-white/70 opacity-60 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

