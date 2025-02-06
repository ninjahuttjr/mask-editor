function generateUUID() {
    return crypto.randomUUID();
  }
  
  export default {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        const corsHeaders = {
          'Access-Control-Allow-Origin': 'https://mask-editor.pages.dev',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Origin',
          'Access-Control-Max-Age': '86400',
        };
  
        if (request.method === 'OPTIONS') {
          return new Response(null, { 
            headers: corsHeaders,
            status: 204
          });
        }
  
        if (url.pathname === '/api/test') {
          return new Response('Test route is working', {
            headers: { 'Content-Type': 'text/plain', ...corsHeaders },
          });
        }
  
        if (url.pathname.startsWith('/api/start-session')) {
          return handleStartSession(request, env, corsHeaders);
        }
  
        if (url.pathname.startsWith('/api/session/')) {
          return handleGetSession(request, env, corsHeaders);
        }
  
        if (url.pathname.startsWith('/api/save-mask')) {
          return handleSaveMask(request, env, corsHeaders);
        }
  
        if (url.pathname.startsWith('/storage/')) {
          return handleGetImage(request, env, corsHeaders);
        }
  
        return new Response('Not Found', { 
          status: 404, 
          headers: corsHeaders 
        });
      } catch (error) {
        console.error('Worker error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            },
          }
        );
      }
    }
  };
  
  async function getImageDimensions(imageBuffer) {
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    const imageBitmap = await createImageBitmap(imageBlob);
    return {
      width: imageBitmap.width,
      height: imageBitmap.height
    };
  }
  
  async function handleStartSession(request, env, corsHeaders) {
    const data = await request.json();
    const sessionId = generateUUID();
    let imageBuffer;
  
    try {
      if (data.image_url) {
        console.log("Starting session. Fetching image from:", data.image_url);
        let modifiedUrl = data.image_url.replace("cdn.discordapp.com", "media.discordapp.net");
        const imageResponse = await fetch(modifiedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; CloudflareWorker)",
            "Referer": "https://discord.com",
            "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
          },
          redirect: "follow"
        });
        
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
  
        imageBuffer = await imageResponse.arrayBuffer();
      } else if (data.image_data) {
        console.log("Using provided image data");
        let base64Data = data.image_data;
        const commaIndex = base64Data.indexOf(',');
        if (commaIndex !== -1) {
          base64Data = base64Data.substring(commaIndex + 1);
        }
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        imageBuffer = bytes.buffer;
      } else {
        throw new Error("No image_data or image_url provided");
      }
  
      if (imageBuffer.byteLength < 100) {
        throw new Error("Invalid image data received");
      }
  
      // Get original image dimensions
      const { width, height } = await getImageDimensions(imageBuffer);
      console.log("Original image dimensions:", { width, height });
  
      const imagePath = `sessions/${sessionId}.png`;
      await env.IMAGE_BUCKET.put(imagePath, imageBuffer, {
        httpMetadata: { 
          contentType: 'image/png',
          customMetadata: { width: width.toString(), height: height.toString() }
        },
      });
  
      const session = {
        id: sessionId,
        imagePath,
        width,
        height,
        createdAt: Date.now(),
        discordUserId: data.discord_user_id,
        channelId: data.channel_id,
        messageId: data.message_id,
      };
  
      await env.SESSIONS.put(sessionId, JSON.stringify(session), {
        expirationTtl: 3600,
      });
  
      const imageUrl = `${new URL(request.url).origin}/storage/${imagePath}`;
  
      return new Response(JSON.stringify({
        sessionId,
        imageUrl,
        width,
        height,
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (error) {
      console.error('Start session error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  }
  
  async function handleGetSession(request, env, corsHeaders) {
    try {
      const url = new URL(request.url);
      const sessionId = url.pathname.split('/').pop();
      const session = await env.SESSIONS.get(sessionId);
  
      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
  
      const sessionData = JSON.parse(session);
      const imageUrl = `${url.origin}/storage/${sessionData.imagePath}`;
      
      return new Response(JSON.stringify({
        id: sessionData.id,
        imageUrl,
        width: sessionData.width,
        height: sessionData.height,
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (error) {
      console.error('Get session error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  }
  
  async function handleSaveMask(request, env, corsHeaders) {
    try {
      const data = await request.json();
      const sessionData = await env.SESSIONS.get(data.sessionId);
  
      if (!sessionData) {
        return new Response(JSON.stringify({ error: 'Session not found' }), { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
  
      const session = JSON.parse(sessionData);
  
      // Convert base64 to Uint8Array
      const maskData = data.maskData.split(',')[1];
      const binaryString = atob(maskData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
  
      const maskPath = `masks/${data.sessionId}.png`;
      
      await env.IMAGE_BUCKET.put(maskPath, bytes, {
        httpMetadata: { 
          contentType: 'image/png',
          customMetadata: {
            width: session.width.toString(),
            height: session.height.toString()
          }
        },
      });
  
      const maskUrl = `${new URL(request.url).origin}/storage/${maskPath}`;
      
      return new Response(JSON.stringify({
        status: 'success',
        maskUrl,
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (error) {
      console.error('Save mask error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  }
  
  async function handleGetImage(request, env, corsHeaders) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace('/storage/', '');
      const object = await env.IMAGE_BUCKET.get(path);
      
      if (!object) {
        return new Response(JSON.stringify({ error: 'Image not found' }), { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
  
      return new Response(object.body, { 
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'image/png',
          ...corsHeaders,
        },
      });
    } catch (error) {
      console.error('Get image error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  }