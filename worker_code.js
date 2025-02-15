function generateUUID() {
    return crypto.randomUUID();
  }
  
  export default {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
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
  
  async function handleStartSession(request, env, corsHeaders) {
    const data = await request.json();
    const sessionId = generateUUID();
    let imageBuffer;
  
    try {
      if (data.image_data) {
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
        throw new Error("No image_data provided");
      }
  
      if (imageBuffer.byteLength < 100) {
        throw new Error("Invalid image data received");
      }
  
      // Use dimensions from request or defaults
      const dimensions = {
        width: data.width || 512,
        height: data.height || 512
      };
      
      console.log("Using image dimensions:", dimensions);
  
      const imagePath = `sessions/${sessionId}.png`;
      await env.IMAGE_BUCKET.put(imagePath, imageBuffer, {
        httpMetadata: { 
          contentType: 'image/png',
          cacheControl: 'public, max-age=3600',
          customMetadata: { 
            width: dimensions.width.toString(), 
            height: dimensions.height.toString() 
          }
        },
      });
  
      // Store session with dimensions and extra fields
      const session = {
        id: sessionId,
        imagePath,
        width: dimensions.width,
        height: dimensions.height,
        createdAt: Date.now(),
        discordUserId: data.discord_user_id,  // Note: our bot sends these in snake_case
        channelId: data.channel_id,
        messageId: data.message_id,
        metadata: data.metadata || {},
      };
  
      await env.SESSIONS.put(sessionId, JSON.stringify(session), {
        expirationTtl: 3600,
      });
  
      return new Response(JSON.stringify({
        sessionId,
        imageUrl: `${new URL(request.url).origin}/storage/${imagePath}`,
        width: dimensions.width,
        height: dimensions.height,
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
      console.log('Getting session:', sessionId);
      
      const session = await env.SESSIONS.get(sessionId);
  
      if (!session) {
        console.error('Session not found:', sessionId);
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
      console.log('Received save mask request for session:', data.sessionId);
      
      if (!data.maskData) {
        throw new Error('No mask data provided');
      }
  
      // Convert base64 to Uint8Array
      const maskData = data.maskData.split(',')[1];
      const binaryString = atob(maskData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
  
      if (bytes.length === 0) {
        throw new Error('Empty mask data received');
      }
  
      const maskPath = `masks/${data.sessionId}.png`;
      console.log('Saving mask to:', maskPath, 'Size:', bytes.length);
      
      // Save the mask image
      await env.IMAGE_BUCKET.put(maskPath, bytes, {
        httpMetadata: { 
          contentType: 'image/png',
          cacheControl: 'public, max-age=3600',
        },
      });
  
      // Verify the saved mask
      const savedMask = await env.IMAGE_BUCKET.get(maskPath);
      if (!savedMask || savedMask.size === 0) {
        throw new Error('Failed to verify saved mask');
      }
  
      const maskUrl = `${new URL(request.url).origin}/storage/${maskPath}`;
      console.log('Generated mask URL:', maskUrl, 'Size:', savedMask.size);
  
      // If any required field is missing, look up the stored session
      if (!data.discordUserId || !data.channelId || !data.messageId || !data.metadata) {
        const sessionStr = await env.SESSIONS.get(data.sessionId);
        if (sessionStr) {
           const session = JSON.parse(sessionStr);
           // Our session stored these keys as sent by the bot (in snake_case)
           data.discordUserId = data.discordUserId || session.discordUserId;
           data.channelId = data.channelId || session.channelId;
           data.messageId = data.messageId || session.messageId;
           data.metadata = data.metadata || session.metadata;
        }
      }
  
      // Validate required fields
      const missing = [];
      if (!data.discordUserId) missing.push("discordUserId");
      if (!data.channelId) missing.push("channelId");
      if (!data.messageId) missing.push("messageId");
      if (!data.metadata || !data.metadata.original_url) missing.push("metadata.original_url");
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(", ")}`);
      }
  
      // Send webhook to Discord bot if the webhook URL is set
      if (env.DISCORD_BOT_WEBHOOK_URL) {
        // Validate and normalize inpainting parameters
        const parameters = {
          denoise: Math.max(0.1, Math.min(1, data.parameters?.denoise || 0.75)),
          steps: Math.max(10, Math.min(50, data.parameters?.steps || 30)),
          guidance: Math.max(1, Math.min(20, data.parameters?.guidance || 7.5)),
          scheduler: ['karras', 'euler_a', 'euler', 'ddim'].includes(data.parameters?.scheduler) 
            ? data.parameters.scheduler 
            : 'karras'
        };
  
        const webhookPayload = {
          sessionId: data.sessionId,
          maskUrl: maskUrl,
          prompt: data.prompt || "",
          parameters,
          metadata: data.metadata,
          discordUserId: data.discordUserId,
          channelId: data.channelId,
          messageId: data.messageId
        };
  
        console.log('Sending webhook with parameters:', parameters);
  
        const webhookResponse = await fetch(env.DISCORD_BOT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });
  
        if (!webhookResponse.ok) {
          console.error('Webhook failed:', await webhookResponse.text());
        }
      }
  
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
      return new Response(JSON.stringify({ 
        error: error.message,
        details: 'Error saving mask image'
      }), {
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
      console.log('Fetching image from path:', path);
  
      const object = await env.IMAGE_BUCKET.get(path);
      
      if (!object) {
        console.error('Image not found:', path);
        return new Response(JSON.stringify({ error: 'Image not found' }), { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
  
      const headers = {
        'Content-Type': object.httpMetadata?.contentType || 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': object.size,
        ...corsHeaders,
      };
  
      return new Response(object.body, { headers });
    } catch (error) {
      console.error('Get image error:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
        path: url.pathname,
        details: 'Error retrieving image from storage'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  }
  