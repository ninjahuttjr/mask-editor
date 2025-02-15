import React from 'react';
import { Info } from 'lucide-react';

const InpaintingControls = ({
  prompt,
  setPrompt,
  denoise,
  setDenoise,
  steps,
  setSteps,
  guidance,
  setGuidance,
  scheduler,
  setScheduler
}) => {
  const schedulerOptions = [
    { value: 'karras', label: 'Karras (Best Quality)' },
    { value: 'euler_a', label: 'Euler Ancestral' },
    { value: 'euler', label: 'Euler' },
    { value: 'ddim', label: 'DDIM' }
  ];

  return (
    <div className="bg-gray-800 p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-white font-medium">Prompt</label>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
              Describe what you want to appear in the masked area
            </div>
          </div>
        </div>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what should appear in the masked area..."
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Denoising</label>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
                Higher values create bigger changes
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={denoise}
              onChange={(e) => setDenoise(Number(e.target.value))}
              className="flex-grow"
            />
            <span className="text-white w-12 text-right">{denoise.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Steps</label>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
                Higher steps = better quality but slower
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="10"
              max="50"
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="flex-grow"
            />
            <span className="text-white w-12 text-right">{steps}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Guidance</label>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
                How closely to follow the prompt
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={guidance}
              onChange={(e) => setGuidance(Number(e.target.value))}
              className="flex-grow"
            />
            <span className="text-white w-12 text-right">{guidance.toFixed(1)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Scheduler</label>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
                Different algorithms for generation
              </div>
            </div>
          </div>
          <select
            value={scheduler}
            onChange={(e) => setScheduler(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white"
          >
            {schedulerOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default InpaintingControls; 