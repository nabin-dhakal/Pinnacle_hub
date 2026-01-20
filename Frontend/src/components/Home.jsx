import { useRef, useState, useEffect } from 'react';
import Tools from './Tools';
import File from './File';
import Profile from './Profile';
import Text from './Text';
import { connectSocket, disconnectSocket, emitDocumentChange, onDocumentChange, offDocumentChange } from '../services/socket';

const Home = () => {
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

    onDocumentChange((delta) => {
      console.log('Received delta from backend:', delta);
      
      if (quillRef.current) {
        const selection = quillRef.current.getSelection();
        
        quillRef.current.updateContents(delta, 'api');
        
        if (selection) {
          setTimeout(() => {
            quillRef.current.setSelection(selection);
          }, 0);
        }
      }
    });

    return () => {
      offDocumentChange();
      disconnectSocket();
    };
  }, []);

  const handleContentChange = (changeData) => {
    setLastChange(changeData);
    console.log('Sending to backend:', changeData.delta);
    
    emitDocumentChange(changeData.delta);
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

export default Home;