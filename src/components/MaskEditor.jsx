import React, { useEffect, useState, useRef } from 'react';
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
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const sessionId = window.location.pathname.split('/').pop();

  useEffect(() => {
    const initializeCanvas = async () => {
      try {
        console.log('Initializing editor with session:', sessionId);
        
        // Fetch session data
        const response = await fetch(`${WORKER_URL}/api/session/${sessionId}`);
        console.log('Session response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Session fetch error:', errorText);
          throw new Error(`Failed to fetch session: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Session data:', data);

        // Create a lower-level canvas element first
        const canvasEl = canvasRef.current;
        canvasEl.width = data.width || 512;
        canvasEl.height = data.height || 512;

        // Initialize Fabric canvas
        const fabricCanvas = new fabric.Canvas(canvasEl, {
          isDrawingMode: true,
          backgroundColor: '#2d3748'
        });

        console.log('Canvas initialized with dimensions:', fabricCanvas.width, fabricCanvas.height);

        // Configure brush settings
        const brush = new fabric.PencilBrush(fabricCanvas);
        brush.color = 'rgba(255,255,255,0.5)';
        brush.width = brushSize;
        fabricCanvas.freeDrawingBrush = brush;

        // Load the image
        console.log('Loading image from:', data.imageUrl);
        await new Promise((resolve, reject) => {
          fabric.Image.fromURL(
            data.imageUrl,
            (img) => {
              if (!img) {
                reject(new Error('Failed to load image'));
                return;
              }
              
              console.log('Image loaded:', {
                width: img.width,
                height: img.height
              });

              // Scale image to fit canvas while maintaining aspect ratio
              const scaleX = fabricCanvas.width / img.width;
              const scaleY = fabricCanvas.height / img.height;
              const scale = Math.min(scaleX, scaleY);
              
              img.set({
                scaleX: scale,
                scaleY: scale,
                selectable: false,
                evented: false,
                left: (fabricCanvas.width - (img.width * scale)) / 2,
                top: (fabricCanvas.height - (img.height * scale)) / 2
              });

              // Add image as background
              fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
              resolve();
            },
            {
              crossOrigin: 'anonymous'
            }
          );
        });

        // Record history on path creation
        fabricCanvas.on('path:created', () => {
          addToHistory(fabricCanvas.toJSON(['backgroundImage']));
        });

        setCanvas(fabricCanvas);
        addToHistory(fabricCanvas.toJSON(['backgroundImage']));
        setLoading(false);

      } catch (error) {
        console.error('Editor initialization failed:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    initializeCanvas();

    // Cleanup: Dispose the canvas on unmount.
    return () => {
      if (canvas) {
        canvas.dispose();
      }
    };
  }, [sessionId]);

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
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-center justify-center"
      >
        {/* The canvas has an inline red border for debugging */}
        <canvas ref={canvasRef} className="shadow-lg" style={{ border: "1px solid red" }} />
      </div>
    </div>
  );
};

export default MaskEditor;
