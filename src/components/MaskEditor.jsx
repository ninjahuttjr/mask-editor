import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { fabric } from 'fabric';
import Toolbar from './Toolbar';
import { WORKER_URL } from '../config';

// Utility functions
const getImageDimensions = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
    img.crossOrigin = 'anonymous';
  });
};

const calculateScaledDimensions = (width, height, maxSize = 512) => {
  width = Number(width);
  height = Number(height);
  const aspectRatio = width / height;

  if (width <= maxSize && height <= maxSize) {
    return { width, height };
  }

  if (width > height) {
    return {
      width: maxSize,
      height: Math.round(maxSize / aspectRatio)
    };
  }

  return {
    width: Math.round(maxSize * aspectRatio),
    height: maxSize
  };
};

const MaskEditor = () => {
  const [canvas, setCanvas] = useState(null);
  const [mode, setMode] = useState('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [dimensions, setDimensions] = useState({ width: 512, height: 512 });
  const [sessionData, setSessionData] = useState(null);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sessionId = window.location.pathname.split('/').pop();

  // Fetch session data and initialize dimensions
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const response = await fetch(`${WORKER_URL}/api/session/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        const data = await response.json();
        setSessionData(data);
        const imageDimensions = await getImageDimensions(data.imageUrl);
        const scaledDimensions = calculateScaledDimensions(
          imageDimensions.width,
          imageDimensions.height
        );
        setDimensions(scaledDimensions);
        setLoading(false);
      } catch (error) {
        console.error('Session fetch failed:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  // Initialize Fabric canvas for mask drawing (without the background image)
  useLayoutEffect(() => {
    if (!sessionData || !containerRef.current) return;
    
    // Clear any existing canvas
    if (canvasRef.current) {
      containerRef.current.innerHTML = '';
    }

    const canvasEl = document.createElement('canvas');
    canvasEl.width = dimensions.width;
    canvasEl.height = dimensions.height;
    containerRef.current.appendChild(canvasEl);
    canvasRef.current = canvasEl;

    // Create Fabric canvas with a black background
    const fabricCanvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: '#000000'
    });

    // Set up brush for drawing white strokes (the mask)
    const brush = new fabric.PencilBrush(fabricCanvas);
    brush.color = '#ffffff';
    brush.width = brushSize;
    fabricCanvas.freeDrawingBrush = brush;

    // Initialize history for undo/redo
    const initialState = JSON.stringify(fabricCanvas.toJSON());
    setHistory([initialState]);
    setHistoryIndex(0);
    
    fabricCanvas.on('path:created', () => {
      const canvasState = JSON.stringify(fabricCanvas.toJSON());
      setHistory(prev => {
        const newHistory = [...prev.slice(0, historyIndex + 1), canvasState];
        return newHistory.slice(-50);
      });
      setHistoryIndex(prev => prev + 1);
    });

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, [sessionData, dimensions, brushSize]);

  // Update brush size when changed
  useEffect(() => {
    if (!canvas?.freeDrawingBrush) return;
    canvas.freeDrawingBrush.width = brushSize;
  }, [brushSize, canvas]);

  // History management
  const undo = () => {
    if (historyIndex > 0 && canvas) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      canvas.loadFromJSON(history[newIndex], () => canvas.renderAll());
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && canvas) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      canvas.loadFromJSON(history[newIndex], () => canvas.renderAll());
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = newMode === 'eraser' ? '#000000' : '#ffffff';
    }
  };

  const handleSave = async () => {
    if (!canvas || isSaving) return;
    
    try {
      setIsSaving(true);
      setError(null);

      // Export only the mask drawing (the canvas background is black)
      const maskData = canvas.toDataURL('image/png');
      
      const response = await fetch(`${WORKER_URL}/api/save-mask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          maskData,
          prompt
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save mask');
      }

      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 left-4 bg-green-500 text-white p-4 rounded-lg text-center';
      notification.innerHTML = `
        <div class="flex flex-col gap-2">
          <div>Mask saved successfully! Processing will continue in Discord...</div>
          <div class="text-sm">This window will close in 3 seconds</div>
        </div>
      `;
      document.body.appendChild(notification);

      if (data.shouldClose) {
        setTimeout(() => window.close(), 3000);
      }
    } catch (error) {
      console.error('Save error:', error);
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading editor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-red-500 p-4 bg-gray-800 rounded-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <div className="bg-gray-800 p-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt for inpainting..."
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
      </div>
      <Toolbar
        mode={mode}
        onModeChange={handleModeChange}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <div className="flex-1 p-4 flex items-center justify-center relative">
        {/* Display the original image as a semi-transparent reference */}
        <img
          src={sessionData.imageUrl}
          alt="Original"
          style={{
            position: 'absolute',
            width: dimensions.width,
            height: dimensions.height,
            objectFit: 'contain',
            opacity: 0.3,
            zIndex: 1,
          }}
        />
        {/* The canvas for mask drawing */}
        <div
          ref={containerRef}
          className="bg-gray-800 rounded-lg shadow-lg"
          style={{
            position: 'relative',
            zIndex: 2,
            width: dimensions.width,
            height: dimensions.height
          }}
        />
      </div>
    </div>
  );
};

export default MaskEditor;
