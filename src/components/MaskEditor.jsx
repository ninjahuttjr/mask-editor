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
  const [sessionData, setSessionData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 512, height: 512 });

  // First effect: Fetch session data
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
        setSessionData(data);
        setDimensions({
          width: data.width || 512,
          height: data.height || 512
        });
      } catch (error) {
        console.error('Session fetch failed:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  // Second effect: Initialize canvas after session data is loaded and canvas is mounted
  useEffect(() => {
    if (!sessionData || !canvasRef.current) {
      console.log('Waiting for canvas element and session data...', {
        hasSessionData: !!sessionData,
        hasCanvasRef: !!canvasRef.current
      });
      return;
    }

    console.log('Initializing canvas with dimensions:', dimensions);
    let fabricCanvas = null;

    const initializeCanvas = async () => {
      try {
        // Initialize Fabric canvas
        fabricCanvas = new fabric.Canvas(canvasRef.current, {
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

        // Load the image
        console.log('Loading image from:', sessionData.imageUrl);
        await new Promise((resolve, reject) => {
          fabric.Image.fromURL(
            sessionData.imageUrl,
            (img) => {
              if (!img) {
                reject(new Error('Failed to load image'));
                return;
              }

              console.log('Image loaded successfully');
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

              fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
              resolve();
            },
            { crossOrigin: 'anonymous' }
          );
        });

        fabricCanvas.on('path:created', () => {
          addToHistory(fabricCanvas.toJSON(['backgroundImage']));
        });

        setCanvas(fabricCanvas);
        addToHistory(fabricCanvas.toJSON(['backgroundImage']));
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
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-center justify-center"
      >
        {/* The canvas has an inline red border for debugging */}
        <canvas 
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="shadow-lg"
        />
      </div>
    </div>
  );
};

export default MaskEditor;
