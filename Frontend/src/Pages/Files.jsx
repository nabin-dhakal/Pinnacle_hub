import { useRef, useState, useEffect } from 'react';
import Tools from '../components/Tools';
import File from '../components/File';
import Profile from '../components/Profile';
import Text from '../components/Text';
import {logout} from '../services/auth'
import { connectSocket, disconnectSocket, emitDocumentChange, onDocumentChange, offDocumentChange } from '../services/socket';

const Files = () => {
  const quillRef = useRef(null);
  const [lastChange, setLastChange] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = connectSocket('default-doc', 'User123');
    
    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

onDocumentChange((message) => {
  
  if (message.type === 'init' && quillRef.current) {
    console.log('Applying initial operations:', message.payload.operations);
    const operations = message.payload.operations;
    operations.forEach(op => {
      console.log('Applying delta:', op.delta);
      quillRef.current.updateContents(op.delta, 'api');
    });
    return;
  }
  
  if (message.type === 'operation') {
    console.log('Processing operation...');
    
    
    if (quillRef.current && message.payload?.delta) {
      console.log('Applying delta to Quill:', message.payload.delta);
      try {
        quillRef.current.updateContents(message.payload.delta, 'api');
        console.log('Delta applied successfully');
      } catch (error) {
        console.error('Error applying delta:', error);
      }
    } else {
      console.log('Missing quillRef or delta');
    }
  }
});

    return () => {
      offDocumentChange();
      disconnectSocket();
    };
  }, []);

  const handleContentChange = (changeData) => {

    
    emitDocumentChange({
      delta: changeData.delta,
      userId: USER_ID,
    });
  };

  return (
    <div className="min-h-screen bg-gray-200">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <File />

          
          <div className="flex items-center gap-4">
            <Tools quillRef={quillRef} />
            
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <Profile />
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg">
          <Text 
            quillRef={quillRef} 
            onContentChange={handleContentChange}
          />
        </div>

        {lastChange && (
          <div className="mt-4 bg-gray-800 text-green-400 p-4 rounded font-mono text-xs overflow-auto max-h-60">
            <div className="mb-2 text-yellow-400 font-bold">Last Change:</div>
            <pre>{JSON.stringify(lastChange.delta, null, 2)}</pre>
            
            <div className="mt-4 mb-2 text-yellow-400 font-bold">Full Document:</div>
            <pre>{JSON.stringify(lastChange.contents, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default File;