function generateUUID() {
    return crypto.randomUUID();
  }
  
  export default {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*', // Temporarily allow all origins
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
    // Simple PNG dimension parsing
    // PNG files start with an IHDR chunk that contains dimensions
    const view = new DataView(imageBuffer);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return { width, height };
  }
  
  async function handleStartSession(request, env, corsHeaders) {
    const data = await request.json();
    const sessionId = generateUUID();
    let imageBuffer;
  
    try {
      // Handle image data
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
  
      // Store session with metadata
      const session = {
        id: sessionId,
        imagePath,
        width,
        height,
        createdAt: Date.now(),
        discordUserId: data.discord_user_id,
        channelId: data.channel_id,
        messageId: data.message_id,
        metadata: data.metadata || {}, // Store the metadata from the request
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
      console.log('Received save mask request for session:', data.sessionId);
      
      const sessionData = await env.SESSIONS.get(data.sessionId);
      if (!sessionData) {
        console.error('Session not found:', data.sessionId);
        return new Response(JSON.stringify({ error: 'Session not found' }), { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
  
      const session = JSON.parse(sessionData);
      console.log('Found session:', session);
  
      // Convert base64 to Uint8Array
      const maskData = data.maskData.split(',')[1];
      const binaryString = atob(maskData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
  
      const maskPath = `masks/${data.sessionId}.png`;
      console.log('Saving mask to:', maskPath);
      
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
      console.log('Generated mask URL:', maskUrl);
      
      // Send webhook to Discord bot
      try {
        if (!env.DISCORD_BOT_WEBHOOK_URL) {
          throw new Error('Discord bot webhook URL not configured');
        }
        console.log('Sending webhook to:', env.DISCORD_BOT_WEBHOOK_URL);
        
        const webhookPayload = {
          sessionId: data.sessionId,
          maskUrl: maskUrl,
          metadata: session.metadata,
          discordUserId: session.discordUserId,
          channelId: session.channelId,
          messageId: session.messageId,
          prompt: data.prompt  // Include the prompt in webhook payload
        };
        console.log('Webhook payload:', webhookPayload);
  
        const webhookResponse = await fetch(env.DISCORD_BOT_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });
  
        console.log('Webhook response status:', webhookResponse.status);
        const responseText = await webhookResponse.text();
        console.log('Webhook response:', responseText);
  
        if (!webhookResponse.ok) {
          throw new Error(`Webhook failed with status ${webhookResponse.status}: ${responseText}`);
        }
      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
        // Continue even if webhook fails - don't block the user
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