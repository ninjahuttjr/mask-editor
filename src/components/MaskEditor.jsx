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
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const sessionId = window.location.pathname.split('/').pop();
  const [sessionData, setSessionData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 512, height: 512 });
  const [maskUrl, setMaskUrl] = useState(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [canvasState, setCanvasState] = useState(null);
  const [prompt, setPrompt] = useState('');

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

        // First set the session data
        setSessionData(data);

        // Then get the actual image dimensions
        const imageDimensions = await getImageDimensions(data.imageUrl);
        console.log('Actual image dimensions:', imageDimensions);

        // Calculate new dimensions based on actual image size
        const scaledDimensions = calculateScaledDimensions(
          imageDimensions.width,
          imageDimensions.height
        );
        
        console.log('Setting final dimensions:', scaledDimensions);
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

  // Calculate scaled dimensions to fit within max size while maintaining aspect ratio
  const calculateScaledDimensions = (width, height, maxSize = 512) => {
    console.log('Input dimensions:', { width, height, maxSize });
    
    // Force dimensions to be numbers
    width = Number(width);
    height = Number(height);
    
    const aspectRatio = width / height;
    let newWidth, newHeight;

    // For portrait images (taller than wide)
    if (height > width) {
      // Start with max height
      newHeight = maxSize;
      newWidth = Math.round(maxSize * aspectRatio);
      
      // If width is too large, scale down proportionally
      if (newWidth > maxSize) {
        newWidth = maxSize;
        newHeight = Math.round(maxSize / aspectRatio);
      }
    } else {
      // For landscape, start with max width
      newWidth = maxSize;
      newHeight = Math.round(maxSize / aspectRatio);
      
      // If height is too large, scale down proportionally
      if (newHeight > maxSize) {
        newHeight = maxSize;
        newWidth = Math.round(maxSize * aspectRatio);
      }
    }

    console.log('New calculated dimensions:', { 
      newWidth, 
      newHeight, 
      aspectRatio,
      originalAspectRatio: width/height 
    });
    
    return { width: newWidth, height: newHeight };
  };

  // Use layout effect to initialize canvas after DOM updates
  useLayoutEffect(() => {
    if (!sessionData || !containerRef.current || !dimensions.width || !dimensions.height) {
      console.log('Waiting for all required data...');
      return;
    }

    console.log('Initializing canvas with dimensions:', dimensions);
    
    const canvasEl = document.createElement('canvas');
    canvasEl.width = dimensions.width;
    canvasEl.height = dimensions.height;
    canvasEl.style.width = `${dimensions.width}px`;
    canvasEl.style.height = `${dimensions.height}px`;
    canvasEl.className = 'rounded-lg';
    
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(canvasEl);
    canvasRef.current = canvasEl;

    const fabricCanvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: '#2d3748'
    });

    // Configure brush with 100% opacity
    const brush = new fabric.PencilBrush(fabricCanvas);
    brush.color = mode === 'eraser' ? '#2d3748' : '#ffffff';
    brush.width = brushSize;
    brush.opacity = 1; // Force 100% opacity
    fabricCanvas.freeDrawingBrush = brush;

    // Ensure paths are created with full opacity
    fabricCanvas.on('path:created', (e) => {
      const path = e.path;
      path.set({
        opacity: 1,
        strokeWidth: brushSize,
        stroke: mode === 'eraser' ? '#2d3748' : '#ffffff'
      });
      fabricCanvas.renderAll();
      const canvasState = JSON.stringify(fabricCanvas.toJSON());
      addToHistory(canvasState);
    });

    // Handle undo/redo state
    const handleHistoryChange = () => {
      const canvasState = JSON.stringify(fabricCanvas.toJSON());
      addToHistory(canvasState);
    };

    fabricCanvas.on('object:added', handleHistoryChange);
    fabricCanvas.on('object:modified', handleHistoryChange);
    fabricCanvas.on('object:removed', handleHistoryChange);

    // Load image
    fabric.Image.fromURL(
      sessionData.imageUrl,
      (img) => {
        if (!img) {
          console.error('Failed to load image');
          setError('Failed to load image');
          setLoading(false);
          return;
        }

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

        fabricCanvas.setBackgroundImage(img, () => {
          fabricCanvas.renderAll();
          console.log('Background image set');
          
          // Save initial state to history
          const initialState = JSON.stringify(fabricCanvas.toJSON());
          addToHistory(initialState);
          
          setLoading(false);
        });
      },
      { crossOrigin: 'anonymous' }
    );

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, [sessionData, dimensions, brushSize, mode]);

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
    setHistory(prev => {
      const newHistory = [...prev.slice(0, historyIndex + 1), canvasState];
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0 && canvas) {
      setHistoryIndex(prev => prev - 1);
      canvas.loadFromJSON(history[historyIndex - 1], () => {
        canvas.renderAll();
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && canvas) {
      setHistoryIndex(prev => prev + 1);
      canvas.loadFromJSON(history[historyIndex + 1], () => {
        canvas.renderAll();
      });
    }
  };

  // Modify brush size without reloading canvas state
  useEffect(() => {
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = mode === 'eraser' ? '#2d3748' : '#ffffff';
    }
  }, [brushSize, canvas, mode]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (canvas) {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = newMode === 'eraser' ? '#2d3748' : '#ffffff';
      canvas.freeDrawingBrush.opacity = 1;
      canvas.renderAll();
    }
  };

  // Save functionality.
  const handleSave = async () => {
    if (!canvas) return;
    
    setIsSaving(true);
    try {
      const maskDataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1
      });
      
      const response = await fetch(`${WORKER_URL}/api/save-mask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sessionId: sessionId,
          maskData: maskDataUrl,
          // The worker will get these from the stored session
          // discordUserId, channelId, messageId, and metadata
        }),
      });

      if (!response.ok) throw new Error('Failed to save mask');

      setShowSaveSuccess(true);
      
      // Close window after brief delay to show success state
      setTimeout(() => {
        window.close();
      }, 1000);

    } catch (error) {
      console.error('Error saving mask:', error);
      setError('Failed to save mask');
    } finally {
      setIsSaving(false);
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
        maskUrl={maskUrl}
        showSaveSuccess={showSaveSuccess}
        processingStatus={processingStatus}
      />
      <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
        <div 
          ref={containerRef}
          className="bg-gray-800 rounded-lg shadow-lg overflow-hidden max-w-full max-h-full"
          style={{ 
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            transform: 'scale(var(--canvas-scale))',
            transformOrigin: 'center center'
          }}
        />
      </div>
      {error && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-500 text-white p-4 rounded-lg">
          {error}
        </div>
      )}
      {isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-4 rounded-lg text-white">
            Saving mask...
          </div>
        </div>
      )}
      {successMessage && (
        <div className="fixed bottom-4 left-4 right-4 bg-green-500 text-white p-4 rounded-lg text-center">
          {successMessage}
        </div>
      )}
    </div>
  );
};

export default MaskEditor;
