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
    { value: 'normal', label: 'Normal (Default)' },
    { value: 'simple', label: 'Simple' },
    { value: 'ddim_uniform', label: 'DDIM Uniform' },
    { value: 'exponential', label: 'Exponential' }
  ];

  const handleDenoiseChange = (e) => {
    const value = parseFloat(e.target.value);
    setDenoise(Math.max(0.1, Math.min(1, value)));
  };

  const handleStepsChange = (e) => {
    const value = parseInt(e.target.value);
    setSteps(Math.max(10, Math.min(50, value)));
  };

  const handleGuidanceChange = (e) => {
    const value = parseFloat(e.target.value);
    setGuidance(Math.max(1, Math.min(30, value)));
  };

  return (
    <div className="bg-gray-800 p-4 space-y-4 rounded-lg">
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

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-white font-medium">Denoise Strength</label>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
              Controls how much the masked area changes. Higher values mean more dramatic changes.
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
            onChange={handleDenoiseChange}
            className="w-full"
          />
          <span className="text-sm">{denoise.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-white font-medium">Steps</label>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
              Number of steps to generate the image. More steps generally mean better quality but slower generation.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="10"
            max="50"
            step="1"
            value={steps}
            onChange={handleStepsChange}
            className="w-full"
          />
          <span className="text-sm">{steps}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-white font-medium">Guidance Scale</label>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
              Controls how closely the result matches your prompt
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="1"
            max="30"
            step="0.5"
            value={guidance}
            onChange={handleGuidanceChange}
            className="w-full"
          />
          <span className="text-sm text-white">{guidance.toFixed(1)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-white font-medium">Scheduler</label>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-700 text-sm text-white rounded-lg shadow-lg z-50">
              Different schedulers can produce different results. Karras generally produces the best quality.
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
  );
};

export default InpaintingControls; 