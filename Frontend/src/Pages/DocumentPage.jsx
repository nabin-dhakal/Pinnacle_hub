import { useParams, useNavigate } from "react-router-dom";
import { getToken, getCurrentUserId } from "../services/auth";
import { useState, useEffect, useRef } from "react";

const BASE_URL = "https://api-pinnacle-hub.nabindhakal10.com.np";
const WS_URL = "ws://api-pinnacle-hub.nabindhakal10.com.np";

const DocumentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");
  const [version, setVersion] = useState(1);
  const [activeUsers, setActiveUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUsername, setShareUsername] = useState("");
  const [sharePermission, setSharePermission] = useState("VIEW");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFormat, setExportFormat] = useState("txt");
  const [selectedText, setSelectedText] = useState("");

  const wsRef = useRef(null);
  const contentRef = useRef(content);
  const versionRef = useRef(version);
  const saveTimeoutRef = useRef(null);
  const pendingLocalVersionsRef = useRef(new Set());
  const reconnectTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    contentRef.current = content;
    updateCounts(content);
  }, [content]);

  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchDocument();
  }, [id]);

  useEffect(() => {
    if (doc && !doc.error) {
      connectWebSocket();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [doc]);

  const updateCounts = (text) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    setWordCount(words);
    setCharCount(chars);
  };

  const fetchDocument = async () => {
    try {
      const token = getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(`${BASE_URL}/files/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDoc(data);
      setNewName(data.name);

      if (typeof data.content === "string") {
        setContent(data.content);
      } else if (data.content?.ops) {
        const text = data.content.ops
          .map((op) => (typeof op.insert === "string" ? op.insert : ""))
          .join("");
        setContent(text);
      } else if (data.content?.text?.text) {
        setContent(data.content.text.text);
      }

      setVersion(data.version || 1);
      setError(null);
    } catch (error) {
      console.error("Failed to fetch document:", error);
      setError("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const token = getToken();
      setConnectionStatus("connecting");

      const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
        setError(null);

        ws.send(
          JSON.stringify({
            type: "subscribe",
            document_id: id,
          })
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "document_state":
            if (typeof data.content === "string") {
              setContent(data.content);
            } else if (data.content?.ops) {
              const text = data.content.ops
                .map((op) => (typeof op.insert === "string" ? op.insert : ""))
                .join("");
              setContent(text);
            } else if (data.content?.text?.text) {
              setContent(data.content.text.text);
            }
            setVersion(data.version || 1);
            break;

          case "edit":
            if (!pendingLocalVersionsRef.current.has(data.version)) {
              let currentContent = contentRef.current;
              data.operations.forEach((op) => {
                if (op.type === "insert") {
                  currentContent =
                    currentContent.slice(0, op.position) +
                    op.text +
                    currentContent.slice(op.position);
                } else if (op.type === "delete") {
                  currentContent =
                    currentContent.slice(0, op.position) +
                    currentContent.slice(op.position + op.length);
                }
              });
              setContent(currentContent);
              setVersion(data.version);
            } else {
              pendingLocalVersionsRef.current.delete(data.version);
            }
            break;

          case "user_joined":
            setActiveUsers((prev) =>
              prev.some((u) => u.id === data.user_id)
                ? prev
                : [...prev, { id: data.user_id, name: data.user_name || "User" }]
            );
            break;

          case "user_left":
            setActiveUsers((prev) =>
              prev.filter((u) => u.id !== data.user_id)
            );
            break;

          case "error":
            setError(data.message);
            break;
        }
      };

      ws.onerror = () => {
        setConnectionStatus("disconnected");
        setError("Connection lost. Changes will save when online.");
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;

        setConnectionStatus("disconnected");
        wsRef.current = null;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (doc) {
            connectWebSocket();
          }
        }, 3000);
      };
    } catch (error) {
      setConnectionStatus("disconnected");
    }
  };

  const createOperation = (oldText, newText) => {
    if (oldText === newText) return null;

    let prefixLen = 0;
    while (
      prefixLen < oldText.length &&
      prefixLen < newText.length &&
      oldText[prefixLen] === newText[prefixLen]
    ) {
      prefixLen++;
    }

    let suffixLen = 0;
    while (
      suffixLen < oldText.length - prefixLen &&
      suffixLen < newText.length - prefixLen &&
      oldText[oldText.length - 1 - suffixLen] ===
        newText[newText.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    const oldMiddle = oldText.slice(prefixLen, oldText.length - suffixLen);
    const newMiddle = newText.slice(prefixLen, newText.length - suffixLen);

    if (oldMiddle.length === 0 && newMiddle.length === 0) return null;

    if (oldMiddle.length === 0) {
      return { type: "insert", position: prefixLen, text: newMiddle };
    }

    if (newMiddle.length === 0) {
      return { type: "delete", position: prefixLen, length: oldMiddle.length };
    }

    return [
      { type: "delete", position: prefixLen, length: oldMiddle.length },
      { type: "insert", position: prefixLen, text: newMiddle },
    ];
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    const oldContent = contentRef.current;

    const operationOrArray = createOperation(oldContent, newContent);

    if (operationOrArray) {
      const operations = [].concat(operationOrArray);
      setContent(newContent);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const localVersion = versionRef.current;
        pendingLocalVersionsRef.current.add(localVersion);

        wsRef.current.send(
          JSON.stringify({
            type: "edit",
            document_id: id,
            data: {
              operations,
              version: localVersion,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        autoSaveDocument(newContent);
      }, 2000);
    }
  };

  const autoSaveDocument = async (contentToSave) => {
    if (!isOnline) return;

    try {
      const token = getToken();

      const response = await fetch(`${BASE_URL}/files/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: {
            text: { text: contentToSave },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedDoc = await response.json();
      setDoc(updatedDoc);
      setVersion(updatedDoc.version || versionRef.current + 1);
      setError(null);
    } catch (error) {
      console.error("Failed to auto-save document:", error);
      setError("Auto-save failed");
    }
  };

  const manualSave = async () => {
    setSaving(true);
    await autoSaveDocument(content);
    setSaving(false);
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === doc.name) {
      setIsRenaming(false);
      return;
    }

    try {
      const token = getToken();

      const response = await fetch(`${BASE_URL}/files/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedDoc = await response.json();
      setDoc(updatedDoc);
      setIsRenaming(false);
    } catch (error) {
      console.error("Failed to rename document:", error);
      setError("Failed to rename document");
    }
  };

  const handleShare = async () => {
    if (!shareUsername) return;

    try {
      const token = getToken();

      const response = await fetch(`${BASE_URL}/files/${id}/share`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: shareUsername,
          permission: sharePermission,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setShowShareModal(false);
      setShareUsername("");
    } catch (error) {
      console.error("Failed to share document:", error);
      setError("Failed to share document");
    }
  };

  const handleFind = () => {
    if (!findText || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const content = textarea.value;
    const startPos = textarea.selectionStart;
    
    const findIndex = content.indexOf(findText, startPos + 1);
    if (findIndex !== -1) {
      textarea.focus();
      textarea.setSelectionRange(findIndex, findIndex + findText.length);
    } else {
      const firstIndex = content.indexOf(findText);
      if (firstIndex !== -1) {
        textarea.setSelectionRange(firstIndex, firstIndex + findText.length);
      }
    }
  };

  const handleReplace = () => {
    if (!findText || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (selectedText === findText) {
      const newContent = content.substring(0, start) + replaceText + content.substring(end);
      setContent(newContent);
      autoSaveDocument(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + replaceText.length);
      }, 0);
    }
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    const newContent = content.split(findText).join(replaceText);
    setContent(newContent);
    autoSaveDocument(newContent);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc?.name || 'document'}.${exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleTextSelection = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    setSelectedText(content.substring(start, end));
  };

  const applyFormatting = (before, after = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    
    let newContent;
    let newCursorPos;

    if (selected) {
      newContent = 
        content.substring(0, start) + 
        before + selected + after + 
        content.substring(end);
      newCursorPos = start + before.length + selected.length + after.length;
    } else {
      newContent = 
        content.substring(0, start) + 
        before + after + 
        content.substring(end);
      newCursorPos = start + before.length;
    }
    
    const operation = createOperation(content, newContent);
    if (operation) {
      const operations = [].concat(operation);
      setContent(newContent);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const localVersion = versionRef.current;
        pendingLocalVersionsRef.current.add(localVersion);

        wsRef.current.send(
          JSON.stringify({
            type: "edit",
            document_id: id,
            data: {
              operations,
              version: localVersion,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        autoSaveDocument(newContent);
      }, 2000);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const applyList = (prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    
    let lineStart = start;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    const lineEnd = content.indexOf('\n', start);
    const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
    
    let newContent;
    let newCursorPos;
    
    if (line.startsWith(prefix)) {
      newContent = 
        content.substring(0, lineStart) + 
        line.substring(prefix.length) + 
        content.substring(lineEnd === -1 ? content.length : lineEnd);
      newCursorPos = Math.max(0, start - prefix.length);
    } else {
      newContent = 
        content.substring(0, lineStart) + 
        prefix + line + 
        content.substring(lineEnd === -1 ? content.length : lineEnd);
      newCursorPos = start + prefix.length;
    }
    
    const operation = createOperation(content, newContent);
    if (operation) {
      const operations = [].concat(operation);
      setContent(newContent);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const localVersion = versionRef.current;
        pendingLocalVersionsRef.current.add(localVersion);

        wsRef.current.send(
          JSON.stringify({
            type: "edit",
            document_id: id,
            data: {
              operations,
              version: localVersion,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        autoSaveDocument(newContent);
      }, 2000);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const currentUserId = getCurrentUserId();
  const isOwner = doc?.owner_id === currentUserId;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/")}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            {isRenaming ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") {
                      setNewName(doc.name);
                      setIsRenaming(false);
                    }
                  }}
                />
                <button onClick={handleRename} className="text-sm text-blue-600">Save</button>
                <button onClick={() => { setNewName(doc.name); setIsRenaming(false); }} className="text-sm text-gray-500">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-medium text-gray-900">{doc?.name}</h1>
                {isOwner && (
                  <button onClick={() => setIsRenaming(true)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected" ? "bg-green-500" :
                connectionStatus === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"
              }`} />
              <span className="text-xs text-gray-500">
                {connectionStatus === "connected" ? "Connected" :
                 connectionStatus === "connecting" ? "Connecting..." : "Offline"}
              </span>
            </div>

            {activeUsers.length > 0 && (
              <div className="flex items-center -space-x-2">
                {activeUsers.slice(0, 3).map((user) => (
                  <div
                    key={user.id}
                    className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center"
                    title={user.name}
                  >
                    <span className="text-xs font-medium text-blue-800">
                      {user.name?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                ))}
                {activeUsers.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                    <span className="text-xs text-gray-600">+{activeUsers.length - 3}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500">v{version}</span>
            <span className="text-xs text-gray-500">
              {saving ? "Saving..." : "Saved"}
            </span>
            <button
              onClick={manualSave}
              disabled={saving || !isOnline}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            {isOwner && (
              <button
                onClick={() => setShowShareModal(true)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Share
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 mt-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => applyFormatting("**", "**")}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700 font-bold"
            title="Bold"
          >
            B
          </button>
          <button
            onClick={() => applyFormatting("*", "*")}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700 italic"
            title="Italic"
          >
            I
          </button>
          <button
            onClick={() => applyFormatting("`", "`")}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700 font-mono"
            title="Code"
          >
            &lt;&gt;
          </button>
          <span className="w-px h-4 bg-gray-300 mx-1"></span>
          <button
            onClick={() => applyFormatting("# ")}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => applyFormatting("## ")}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => applyFormatting("### ")}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
            title="Heading 3"
          >
            H3
          </button>
          <span className="w-px h-4 bg-gray-300 mx-1"></span>
          <button
            onClick={() => applyList("- ")}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
            title="Bullet list"
          >
            • List
          </button>
          <button
            onClick={() => applyList("1. ")}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
            title="Numbered list"
          >
            1. List
          </button>
          <span className="w-px h-4 bg-gray-300 mx-1"></span>
          <button
            onClick={() => setShowFindReplace(!showFindReplace)}
            className={`p-1.5 rounded hover:bg-gray-100 text-gray-700 ${showFindReplace ? "bg-gray-100" : ""}`}
            title="Find and replace"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
              title="Export"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 z-10">
                <button
                  onClick={() => { setExportFormat("txt"); handleExport(); }}
                  className="block w-full text-left px-4 py-1 text-sm hover:bg-gray-50"
                >
                  Export as TXT
                </button>
                <button
                  onClick={() => { setExportFormat("md"); handleExport(); }}
                  className="block w-full text-left px-4 py-1 text-sm hover:bg-gray-50"
                >
                  Export as MD
                </button>
              </div>
            )}
          </div>
          <span className="w-px h-4 bg-gray-300 mx-1"></span>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
            title="Zoom out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-gray-600 w-12 text-center">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700"
            title="Zoom in"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-700 text-xs"
            title="Reset zoom"
          >
            100%
          </button>
        </div>

        {showFindReplace && (
          <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-gray-100">
            <input
              type="text"
              placeholder="Find"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm w-48"
            />
            <input
              type="text"
              placeholder="Replace with"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm w-48"
            />
            <button
              onClick={handleFind}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              Find
            </button>
            <button
              onClick={handleReplace}
              className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
            >
              Replace all
            </button>
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded">
            {error}
          </div>
        )}
        {!isOnline && (
          <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded">
            Offline - changes will save when connection is restored
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onSelect={handleTextSelection}
            onClick={handleTextSelection}
            onKeyUp={handleTextSelection}
            className="w-full p-4 font-mono text-sm resize-none focus:outline-none min-h-[calc(100vh-220px)]"
            placeholder="Start typing..."
            disabled={connectionStatus === "connecting" && !content}
            style={{ fontSize: `${zoom}%` }}
          />
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-4 py-1.5 text-xs text-gray-500">
        <div className="flex justify-between">
          <div className="flex space-x-4">
            <span>Words: {wordCount}</span>
            <span>Characters: {charCount}</span>
            <span>Lines: {content.split('\n').length}</span>
            {selectedText && (
              <span>Selected: {selectedText.length} chars</span>
            )}
          </div>
          <div>
            {isOwner ? "Owner" : "Collaborator"}
          </div>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded p-6 w-96">
            <h3 className="text-base font-medium mb-4">Share document</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Username"
                value={shareUsername}
                onChange={(e) => setShareUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <select
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="VIEW">Can view</option>
                <option value="EDIT">Can edit</option>
              </select>
              <div className="flex space-x-2 pt-2">
                <button
                  onClick={handleShare}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Share
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentPage;