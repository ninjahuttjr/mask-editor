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
        
        const response = await fetch(`${WORKER_URL}/api/session/${sessionId}`);
        console.log('Session response:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch session: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Session data:', data);

        const fabricCanvas = new fabric.Canvas(canvasRef.current, {
          isDrawingMode: true,
          width: data.width,
          height: data.height,
          backgroundColor: '#2d3748'
        });

        // Load the image
        fabric.Image.fromURL(
          data.imageUrl,
          (img) => {
            if (!img) {
              throw new Error('Failed to load image');
            }
            
            console.log('Image loaded successfully');
            
            img.set({
              selectable: false,
              evented: false,
            });
            
            // Scale image to fit canvas
            const scale = Math.min(
              fabricCanvas.width / img.width,
              fabricCanvas.height / img.height
            );
            
            img.scale(scale);
            img.center();
            
            fabricCanvas.add(img);
            fabricCanvas.renderAll();
            
            setLoading(false);
          },
          { crossOrigin: 'anonymous' }
        );

        // Configure brush settings.
        const brush = new fabric.PencilBrush(fabricCanvas);
        brush.color = 'rgba(255,255,255,0.5)';
        brush.width = brushSize;
        fabricCanvas.freeDrawingBrush = brush;

        // Record history on path creation.
        fabricCanvas.on('path:created', () => {
          addToHistory(fabricCanvas.toJSON());
        });

        setCanvas(fabricCanvas);
        addToHistory(fabricCanvas.toJSON());
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
      canvas.loadFromJSON(history[historyIndex - 1], canvas.renderAll.bind(canvas));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      canvas.loadFromJSON(history[historyIndex + 1], canvas.renderAll.bind(canvas));
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
    if (newMode === 'eraser') {
      canvas.freeDrawingBrush.color = 'rgba(0,0,0,0)';
    } else {
      canvas.freeDrawingBrush.color = 'rgba(255,255,255,0.5)';
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
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-xl text-white">Loading editor...</div>
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
