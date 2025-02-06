import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { fabric } from 'fabric';
import Toolbar from './Toolbar';
import { WORKER_URL } from '../config';

// Log when the component loads
console.log('MaskEditor component loaded');

const MaskEditor = () => {
  console.log('MaskEditor component rendering');

  const [canvas, setCanvas] = useState(null);
  const [mode, setMode] = useState('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const sessionId = window.location.pathname.split('/').pop();
  const [sessionData, setSessionData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 512, height: 512 });

  // Utility function to get image dimensions
  const getImageDimensions = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log('Actual image dimensions:', {
          width: img.naturalWidth,
          height: img.naturalHeight
        });
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

  // Calculate scaled dimensions to fit within max size while maintaining aspect ratio
  const calculateScaledDimensions = (width, height, maxSize = 512) => {
    const aspectRatio = width / height;
    let newWidth = width;
    let newHeight = height;

    if (width > maxSize || height > maxSize) {
      if (width > height) {
        newWidth = maxSize;
        newHeight = Math.round(maxSize / aspectRatio);
      } else {
        newHeight = maxSize;
        newWidth = Math.round(maxSize * aspectRatio);
      }
    }

    return { width: newWidth, height: newHeight };
  };

  // First effect: Fetch session data and validate image
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        console.log('Fetching session data for:', sessionId);
        const response = await fetch(`${WORKER_URL}/api/session/${sessionId}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch session: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Session data received:', data);

        // Validate image dimensions
        console.log('Validating image dimensions...');
        const imageDimensions = await getImageDimensions(data.imageUrl);
        console.log('Image validation complete:', imageDimensions);

        // Calculate appropriate canvas dimensions
        const scaledDimensions = calculateScaledDimensions(
          imageDimensions.width,
          imageDimensions.height
        );
        console.log('Scaled dimensions:', scaledDimensions);

        setDimensions(scaledDimensions);
        setSessionData(data);
      } catch (error) {
        console.error('Session initialization failed:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  // Second effect: Initialize canvas after session data is loaded
  useEffect(() => {
    if (!sessionData || !containerRef.current) {
      console.log('Waiting for initialization...', {
        hasSessionData: !!sessionData,
        hasContainer: !!containerRef.current,
        containerDimensions: containerRef.current ? {
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        } : null,
        currentDimensions: dimensions
      });
      return;
    }

    console.log('Starting canvas initialization with dimensions:', dimensions);
    let fabricCanvas = null;

    const initializeCanvas = async () => {
      try {
        // Create canvas element with wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'canvas-container';
        wrapper.style.width = `${dimensions.width}px`;
        wrapper.style.height = `${dimensions.height}px`;
        
        const canvasEl = document.createElement('canvas');
        canvasEl.width = dimensions.width;
        canvasEl.height = dimensions.height;
        
        wrapper.appendChild(canvasEl);
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(wrapper);

        console.log('Canvas element created with dimensions:', {
          wrapper: {
            width: wrapper.offsetWidth,
            height: wrapper.offsetHeight
          },
          canvas: {
            width: canvasEl.width,
            height: canvasEl.height
          }
        });

        // Initialize Fabric canvas
        fabricCanvas = new fabric.Canvas(canvasEl, {
          isDrawingMode: true,
          width: dimensions.width,
          height: dimensions.height,
          backgroundColor: '#2d3748'
        });

        console.log('Fabric canvas initialized');

        // Configure brush settings
        const brush = new fabric.PencilBrush(fabricCanvas);
        brush.color = 'rgba(255,255,255,0.5)';
        brush.width = brushSize;
        fabricCanvas.freeDrawingBrush = brush;

        // Load and scale the image
        await new Promise((resolve, reject) => {
          fabric.Image.fromURL(
            sessionData.imageUrl,
            (img) => {
              if (!img) {
                reject(new Error('Failed to load image'));
                return;
              }

              // Set image to fill canvas while maintaining aspect ratio
              const scaleX = dimensions.width / img.width;
              const scaleY = dimensions.height / img.height;
              const scale = Math.min(scaleX, scaleY);
              
              img.set({
                scaleX: scale,
                scaleY: scale,
                selectable: false,
                evented: false,
                left: (dimensions.width - (img.width * scale)) / 2,
                top: (dimensions.height - (img.height * scale)) / 2
              });

              fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
              resolve();
            },
            { crossOrigin: 'anonymous' }
          );
        });

        setCanvas(fabricCanvas);
        setLoading(false);

      } catch (error) {
        console.error('Canvas initialization failed:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    initializeCanvas();

    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, [sessionData, dimensions, brushSize]);

  // History management.
  const addToHistory = (canvasState) => {
    setHistory((prev) => {
      const newHistory = [...prev.slice(0, historyIndex + 1), canvasState];
      if (newHistory.length > 50) newHistory.shift(); // Limit history size.
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      canvas.loadFromJSON(history[historyIndex - 1], () => {
        canvas.renderAll();
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      canvas.loadFromJSON(history[historyIndex + 1], () => {
        canvas.renderAll();
      });
    }
  };

  // Update brush width when brushSize changes.
  useEffect(() => {
    if (canvas) {
      canvas.freeDrawingBrush.width = brushSize;
    }
  }, [brushSize, canvas]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (!canvas) return;
    
    canvas.freeDrawingBrush.color = newMode === 'eraser' 
      ? 'rgba(0,0,0,0)' 
      : 'rgba(255,255,255,0.5)';
  };

  // Save functionality.
  const handleSave = async () => {
    if (!canvas) return;
    try {
      const sessionId = window.location.pathname.split('/').pop();
      const maskData = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });
      const response = await fetch(`${WORKER_URL}/api/save-mask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, maskData }),
      });
      if (!response.ok) throw new Error('Failed to save mask');
      window.close();
    } catch (error) {
      console.error('Error saving mask:', error);
      alert('Failed to save mask. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-red-500 p-4 bg-gray-800 rounded-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
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
      />
      <div className="flex-1 overflow-auto p-4">
        <div 
          ref={containerRef}
          className="w-full h-full flex items-center justify-center"
          style={{ minHeight: `${dimensions.height}px` }}
        />
      </div>
    </div>
  );
};

export default MaskEditor;
