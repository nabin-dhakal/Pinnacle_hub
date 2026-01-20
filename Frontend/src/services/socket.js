let socket = null;
let documentId = 'default-doc';

const WS_URL = 'ws://localhost:8000';

export const connectSocket = (docId = 'default-doc', username = 'Anonymous', userId = null) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }

  documentId = docId;
  
  const queryParams = new URLSearchParams({
    username: username,
    ...(userId && { user_id: userId })
  });

  const wsUrl = `${WS_URL}/ws/${documentId}?${queryParams}`;
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('WebSocket connected to document:', documentId);
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected');
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};

export const getSocket = () => socket;

export const emitDocumentChange = (delta) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const message = {
      type: 'operation',
      payload: delta,
      timestamp: Date.now()
    };
    socket.send(JSON.stringify(message));
  }
};

export const onDocumentChange = (callback) => {
  if (socket) {
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'operation') {
          callback(message.payload);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }
};

export const offDocumentChange = () => {
  if (socket) {
    socket.onmessage = null;
  }
};