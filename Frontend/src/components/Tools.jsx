const Tools = ({ quillRef }) => {
  
  const formatText = (format, value = true) => {
    if (!quillRef.current) return;
    
    const selection = quillRef.current.getSelection();
    if (!selection || selection.length === 0) return;
    
    const currentFormat = quillRef.current.getFormat(selection);
    quillRef.current.format(format, currentFormat[format] ? false : value);
  };

  const applyHeading = (level) => {
    if (!quillRef.current) return;
    
    const selection = quillRef.current.getSelection();
    if (!selection) return;
    
    const currentFormat = quillRef.current.getFormat(selection);
    quillRef.current.format('header', currentFormat.header === level ? false : level);
  };

  const applyList = (listType) => {
    if (!quillRef.current) return;
    
    const selection = quillRef.current.getSelection();
    if (!selection) return;
    
    const currentFormat = quillRef.current.getFormat(selection);
    quillRef.current.format('list', currentFormat.list === listType ? false : listType);
  };

  return (
    <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
      
      {/* Text Formatting */}
      <button
        onClick={() => formatText('bold')}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition font-bold"
        title="Bold"
      >
        B
      </button>

      <button
        onClick={() => formatText('italic')}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition italic"
        title="Italic"
      >
        I
      </button>

      <button
        onClick={() => formatText('underline')}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition underline"
        title="Underline"
      >
        U
      </button>

      <button
        onClick={() => formatText('strike')}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition line-through"
        title="Strike"
      >
        S
      </button>

      <div className="w-px h-6 bg-gray-300 mx-2"></div>

      {/* Headings */}
      <button
        onClick={() => applyHeading(1)}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition text-sm font-semibold"
        title="Heading 1"
      >
        H1
      </button>

      <button
        onClick={() => applyHeading(2)}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition text-sm font-semibold"
        title="Heading 2"
      >
        H2
      </button>

      <button
        onClick={() => formatText('header', false)}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition text-sm"
        title="Normal text"
      >
        P
      </button>

      <div className="w-px h-6 bg-gray-300 mx-2"></div>

      {/* Lists */}
      <button
        onClick={() => applyList('bullet')}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition"
        title="Bullet list"
      >
        • List
      </button>

      <button
        onClick={() => applyList('ordered')}
        className="px-3 py-2 rounded hover:bg-white hover:shadow-sm transition"
        title="Numbered list"
      >
        1. List
      </button>

    </div>
  );
};

export default Tools;