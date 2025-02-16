---

# Mask Editor

Mask Editor is a web-based tool built with React that allows you to create and edit image masks for inpainting and image editing. It features an intuitive drawing interface using Fabric.js, dynamic inpainting controls, and integration with a Cloudflare Worker for processing masks.

## Features

- **Interactive Mask Editing:**  
  Draw or erase parts of an image using a responsive brush tool with customizable brush sizes.
  
- **Inpainting Controls:**  
  Adjust parameters like prompt, denoise strength, steps, guidance scale, and scheduler to control the inpainting process.
  
- **Session-Based Editing:**  
  Loads session data and image templates dynamically, and adjusts the canvas size based on the actual image dimensions.
  
- **History Management:**  
  Undo and redo functionality to manage your editing history.
  
- **Cloudflare Worker Integration:**  
  Saves the edited mask and parameters by sending data to a Cloudflare Worker endpoint for further processing.

## Demo

(Include a screenshot or a link to a live demo if available.)

## Getting Started

### Prerequisites

- **Node.js & npm:** Make sure you have Node.js and npm installed.
- **Git:** Required for cloning the repository.

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/ninjahuttjr/mask-editor.git
   cd mask-editor
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set Up Environment Variables:**

   Create a `.env` file in the root of the project and add your Cloudflare Worker URL:

   ```env
   REACT_APP_WORKER_URL=https://your-worker-url.workers.dev
   ```

   **Note:**  
   In this project, the Cloudflare Worker URL is imported via `config.js` using `process.env.REACT_APP_WORKER_URL`.

### Running Locally

Start the development server:

```bash
npm start
```

## Project Structure

```
src/
  ├── components/
  │     ├── MaskEditor.jsx       // Main component for editing masks.
  │     ├── Toolbar.jsx          // Toolbar for drawing controls, undo/redo, and saving.
  │     ├── TestRequest.jsx      // A simple component to test the worker connection.
  │     └── InpaintingControls.jsx  // Component for adjusting inpainting parameters.
  ├── config.js                  // Exports the Cloudflare Worker URL from the environment variable.
  └── index.css                  // Contains global styles and Tailwind CSS configuration.
public/
  └── index.html                 // Contains the main HTML file and other static assets.
```

## Deployment

To build the project for production, run:

```bash
npm run build
```

Then, deploy the contents of the `build` folder to your hosting platform.

--- 

Feel free to adjust or expand this README as needed for your project!
