import React from 'react';
import { 
  Brush,
  Eraser,
  Undo2,
  Redo2,
  Check
} from 'lucide-react'; // Correct Lucide icon names

const ToolButton = ({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-3 py-2 rounded-lg transition-colors
      text-sm font-medium ${
      active ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
    }`}
  >
    <Icon className="w-5 h-5 mr-2" />
    {label}
  </button>
);

const Toolbar = ({ 
  mode,
  onModeChange,
  brushSize,
  onBrushSizeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave
}) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800">
      <div className="flex gap-2">
        <ToolButton
          active={mode === 'brush'}
          icon={Brush}
          label="Brush"
          onClick={() => onModeChange('brush')}
        />
        <ToolButton
          active={mode === 'eraser'}
          icon={Eraser}
          label="Eraser"
          onClick={() => onModeChange('eraser')}
        />
      </div>

      <div className="flex items-center gap-4 ml-4">
        <label className="text-white text-sm">Brush Size:</label>
        <input
          type="range"
          min="1"
          max="100"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(parseInt(e.target.value))}
          className="w-32"
        />
        <span className="text-white text-sm">{brushSize}px</span>
      </div>

      <div className="flex gap-2 ml-4">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-colors ${
            canUndo ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-500'
          }`}
        >
          <Undo2 className="w-5 h-5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-colors ${
            canRedo ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-500'
          }`}
        >
          <Redo2 className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={onSave}
        className="ml-auto flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 
                   text-white rounded-lg transition-colors"
      >
        <Check className="w-5 h-5 mr-2" />
        Save
      </button>
    </div>
  );
};

export default Toolbar;