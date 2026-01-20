import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const Text = ({ quillRef, onContentChange }) => {
  const editorRef = useRef(null);
  const quillInstance = useRef(null);

  useEffect(() => {
    if (quillInstance.current || !editorRef.current) return;
    
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: false,
      },
      placeholder: 'Start typing your document...',
    });

    quillInstance.current = quill;
    quillRef.current = quill;

    quill.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        const contents = quill.getContents();
        
        console.log('Change Delta:', delta);
        console.log('Full Document:', contents);
        
        if (onContentChange) {
          onContentChange({
            delta: delta,
            contents: contents,
            source: source
          });
        }
      }
    });

    return () => {
      if (quillInstance.current) {
        quillInstance.current.off('text-change');
        quillInstance.current = null;
      }
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, [quillRef, onContentChange]);

  return (
    <div className="p-12">
      <div 
        ref={editorRef} 
        className="min-h-[600px] text-base leading-relaxed"
      />
    </div>
  );
};

export default Text;