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
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const sessionId = window.location.pathname.split('/').pop();
  const [sessionData, setSessionData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 512, height: 512 });

  // First effect: Fetch session data
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        console.log('Fetching session data for:', sessionId);
        const response = await fetch(`${WORKER_URL}/api/session/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch session: ${await response.text()}`);
        }
        
        const data = await response.json();
        console.log('Session data received:', data);

        // Validate image dimensions
        const imageDimensions = await getImageDimensions(data.imageUrl);
        const scaledDimensions = calculateScaledDimensions(
          imageDimensions.width,
          imageDimensions.height
        );
        
        setDimensions(scaledDimensions);
        setSessionData(data);
      } catch (error) {
        console.error('Session fetch failed:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  // Calculate scaled dimensions to fit within max size while maintaining aspect ratio
  const calculateScaledDimensions = (width, height, maxSize = 512) => {
    const aspectRatio = width / height;
    let newWidth, newHeight;

    if (width > height) {
      // Landscape orientation
      newWidth = maxSize;
      newHeight = Math.round(maxSize / aspectRatio);
    } else {
      // Portrait orientation
      newHeight = maxSize;
      newWidth = Math.round(maxSize * aspectRatio);
    }

    // Ensure dimensions don't exceed maxSize
    if (newWidth > maxSize) {
      newWidth = maxSize;
      newHeight = Math.round(maxSize / aspectRatio);
    } else if (newHeight > maxSize) {
      newHeight = maxSize;
      newWidth = Math.round(maxSize * aspectRatio);
    }

    console.log('Calculated dimensions:', { newWidth, newHeight, aspectRatio });
    return { width: newWidth, height: newHeight };
  };

  // Use layout effect to initialize canvas after DOM updates
  useLayoutEffect(() => {
    if (!sessionData || !containerRef.current) return;

    console.log('Container mounted, initializing canvas');
    
    const canvasEl = document.createElement('canvas');
    // Use exact dimensions from sessionData if available, otherwise use calculated dimensions
    const canvasWidth = sessionData.width || dimensions.width;
    const canvasHeight = sessionData.height || dimensions.height;
    
    canvasEl.width = canvasWidth;
    canvasEl.height = canvasHeight;
    canvasEl.style.width = `${canvasWidth}px`;
    canvasEl.style.height = `${canvasHeight}px`;
    canvasEl.className = 'rounded-lg';
    
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(canvasEl);
    canvasRef.current = canvasEl;

    // Initialize Fabric canvas
    const fabricCanvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#2d3748'
    });

    // Configure brush
    const brush = new fabric.PencilBrush(fabricCanvas);
    brush.color = 'rgba(255,255,255,0.5)';
    brush.width = brushSize;
    fabricCanvas.freeDrawingBrush = brush;

    // Load image
    fabric.Image.fromURL(
      sessionData.imageUrl,
      (img) => {
        if (!img) {
          console.error('Failed to load image');
          return;
        }

        console.log('Image loaded:', {
          imgWidth: img.width,
          imgHeight: img.height,
          canvasWidth: canvasWidth,
          canvasHeight: canvasHeight
        });

        const scaleX = canvasWidth / img.width;
        const scaleY = canvasHeight / img.height;
        const scale = Math.min(scaleX, scaleY);
        
        img.set({
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          left: (canvasWidth - (img.width * scale)) / 2,
          top: (canvasHeight - (img.height * scale)) / 2
        });

        fabricCanvas.setBackgroundImage(img, () => {
          fabricCanvas.renderAll();
          console.log('Background image set');
          setLoading(false);
        });
      },
      { crossOrigin: 'anonymous' }
    );

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, [sessionData, dimensions, brushSize]);

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
    if (canvas) {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = newMode === 'eraser' ? '#2d3748' : 'rgba(255,255,255,0.5)';
    }
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
      <div className="flex-1 p-4 flex items-center justify-center">
        <div 
          ref={containerRef}
          className="bg-gray-800 rounded-lg shadow-lg overflow-hidden"
          style={{ 
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`
          }}
        />
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
          <div className="text-white text-lg">Loading editor...</div>
        </div>
      )}
    </div>
  );
};

export default MaskEditor;
