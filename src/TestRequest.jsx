// TestRequest.jsx
import React, { useEffect } from 'react';

const TestRequest = () => {
  useEffect(() => {
    const testWorker = async () => {
      try {
        console.log('Testing worker connection...');
        const response = await fetch('https://proud-sky-f006.2qzyhk4jvk.workers.dev/api/test');
        console.log('Response:', response.status);
        const text = await response.text();
        console.log('Response text:', text);
      } catch (error) {
        console.error('Error testing worker:', error);
      }
    };

    testWorker();
  }, []);

  return null;
};

export default TestRequest;