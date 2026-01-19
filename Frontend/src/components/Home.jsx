import { useRef, useState } from 'react';
import Tools from './Tools';
import File from './File';
import Profile from './Profile';
import Text from './Text';

const Home = () => {
  const quillRef = useRef(null);
  const [lastChange, setLastChange] = useState(null);

  const handleContentChange = (changeData) => {
    setLastChange(changeData);
    console.log('Ready to send to backend:', changeData);
  };

  return (
    <div className="min-h-screen bg-gray-200">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <File />
          <Tools quillRef={quillRef} />
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