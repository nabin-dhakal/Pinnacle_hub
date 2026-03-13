import { useParams, useNavigate } from "react-router-dom";
import { getToken, getCurrentUserId } from "../services/auth";
import { useState, useEffect, useRef } from "react";

const BASE_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000";

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
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUsername, setShareUsername] = useState("");
  const [sharePermission, setSharePermission] = useState("VIEW");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [zoom, setZoom] = useState(100);

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
        console.log("WebSocket connected");
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
              applyOperations(data.operations);
              setVersion(data.version);
            } else {
              pendingLocalVersionsRef.current.delete(data.version);
            }
            break;

          case "user_joined":
            setActiveUsers((prev) =>
              prev.some((u) => u.id === data.user_id)
                ? prev
                : [...prev, { id: data.user_id }]
            );
            break;

          case "user_left":
            setActiveUsers((prev) =>
              prev.filter((u) => u.id !== data.user_id)
            );
            break;

          case "cursor":
            console.log("Cursor update:", data);
            break;

          case "presence":
            console.log("Presence update:", data);
            break;

          case "document_saved":
            if (data.content) {
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
              setVersion(data.version || versionRef.current);
            }
            break;

          case "error":
            console.log("ws error from server", data);
            setError(data.message);
            break;

          default:
            console.log("Unknown message type:", data.type);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("disconnected");
        setError(
          "Real-time connection lost. Changes will be saved when connection resumes."
        );
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;

        console.log("WebSocket disconnected");
        setConnectionStatus("disconnected");
        wsRef.current = null;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (doc) {
            connectWebSocket();
          }
        }, 3000);
      };
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      setConnectionStatus("disconnected");
    }
  };

  const applyOperations = (operations) => {
    let currentContent = contentRef.current;

    operations.forEach((op) => {
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
    if (!isOnline) {
      console.log("Offline: changes will be saved when online");
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

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "document_save",
            document_id: id,
            data: {
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      setError(null);
    } catch (error) {
      console.error("Failed to auto-save document:", error);
      setError("Auto-save failed. Changes will be retried.");
    }
  };

  const manualSave = async () => {
    setSaving(true);
    await autoSaveDocument(content);
    setSaving(false);
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
      alert("Document shared successfully");
    } catch (error) {
      console.error("Failed to share document:", error);
      setError("Failed to share document");
    }
  };

  const handleFindReplace = () => {
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
    a.download = `${doc?.name || 'document'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">Loading document...</div>
        </div>
      </div>
    );
  }

  const currentUserId = getCurrentUserId();
  const isOwner = doc?.owner_id === currentUserId;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/")}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back</span>
              </button>
              
              <div className="flex items-center space-x-3">
                <h1 className="text-lg font-semibold text-gray-800">{doc?.name}</h1>
                
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus === "connected"
                        ? "bg-green-500"
                        : connectionStatus === "connecting"
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm text-gray-500">
                    {connectionStatus === "connected"
                      ? "Connected"
                      : connectionStatus === "connecting"
                      ? "Connecting..."
                      : "Offline"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {activeUsers.length > 0 && (
                <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-1">
                  <div className="flex -space-x-2">
                    {activeUsers.slice(0, 3).map((user, index) => (
                      <div
                        key={user.id}
                        className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs flex items-center justify-center border-2 border-white"
                        title={`User ${index + 1}`}
                      >
                        {user.id?.[0]?.toUpperCase() || "U"}
                      </div>
                    ))}
                    {activeUsers.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center border-2 border-white">
                        +{activeUsers.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">
                    {activeUsers.length} online
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">v{version}</span>
                {saving ? (
                  <span className="text-sm text-gray-500 flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">Saved</span>
                )}
              </div>

              <button
                onClick={manualSave}
                disabled={saving || !isOnline}
                className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Now
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 py-1 border-t border-gray-100">
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
              </svg>
            </button>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Italic">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 4h8 M6 20h8 M14 4L8 20" />
              </svg>
            </button>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Underline">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 4v8a4 4 0 008 0V4 M4 20h16" />
              </svg>
            </button>
            <span className="w-px h-6 bg-gray-300 mx-1"></span>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Find/Replace" onClick={() => setShowFindReplace(!showFindReplace)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Zoom Out" onClick={handleZoomOut}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
              </svg>
            </button>
            <span className="text-sm text-gray-600">{zoom}%</span>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Zoom In" onClick={handleZoomIn}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Reset Zoom" onClick={handleResetZoom}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <span className="w-px h-6 bg-gray-300 mx-1"></span>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Export" onClick={handleExport}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {isOwner && (
              <button
                onClick={() => setShowShareModal(true)}
                className="px-3 py-1.5 bg-green-50 text-green-600 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors ml-auto"
              >
                Share
              </button>
            )}
          </div>

          {showFindReplace && (
            <div className="flex items-center space-x-2 py-2 border-t border-gray-100 bg-gray-50">
              <input
                type="text"
                placeholder="Find"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              />
              <input
                type="text"
                placeholder="Replace with"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              />
              <button
                onClick={handleFindReplace}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Find
              </button>
              <button
                onClick={handleReplace}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Replace
              </button>
              <button
                onClick={handleReplaceAll}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                Replace All
              </button>
            </div>
          )}

          {error && (
            <div className="mt-2 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!isOnline && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 text-yellow-600 px-4 py-2 rounded-lg text-sm">
              You're offline. Changes will sync when connection is restored.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            className="w-full min-h-[500px] p-4 border border-gray-200 rounded-lg font-mono text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Start typing... Changes are auto-saved and shared in real-time"
            disabled={connectionStatus === "connecting" && !content}
            style={{ fontSize: `${zoom}%` }}
          />
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-4 py-2 text-sm text-gray-600">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <span>Words: {wordCount}</span>
            <span>Characters: {charCount}</span>
          </div>
          <div className="flex space-x-4">
            <span>Lines: {content.split('\n').length}</span>
            <span>Owner: {isOwner ? 'You' : doc?.owner_id}</span>
          </div>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Share Document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={shareUsername}
                  onChange={(e) => setShareUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permission
                </label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="VIEW">View Only</option>
                  <option value="SUGGEST">Suggest</option>
                  <option value="EDIT">Edit</option>
                </select>
              </div>
              <div className="flex space-x-2 pt-4">
                <button
                  onClick={handleShare}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Share
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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