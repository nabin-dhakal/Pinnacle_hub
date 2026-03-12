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

  const wsRef = useRef(null);
  const contentRef = useRef(content);
  const versionRef = useRef(version);
  const saveTimeoutRef = useRef(null);
  const pendingLocalVersionsRef = useRef(new Set());
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    contentRef.current = content;
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

  const handleShare = async (userId, permission) => {

    try {
      const token = getToken();

      const response = await fetch(`${BASE_URL}/files/${id}/share`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          permission: permission,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      alert("Document shared successfully");
    } catch (error) {
      console.error("Failed to share document:", error);
      setError("Failed to share document");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading document...</div>
      </div>
    );
  }

  const currentUserId = getCurrentUserId();
  const isOwner = doc?.owner_id === currentUserId;

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/")}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold">{doc?.name}</h1>

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
              <span className="text-sm text-gray-600">
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Offline"}
              </span>
            </div>

            {activeUsers.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-600">
                  {activeUsers.length} active user
                  {activeUsers.length !== 1 ? "s" : ""}
                </span>
                <div className="flex -space-x-2">
                  {activeUsers.slice(0, 3).map((user) => (
                    <div
                      key={user.id}
                      className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center border-2 border-white"
                      title={user.id}
                    >
                      {user.id?.[0]?.toUpperCase() || "U"}
                    </div>
                  ))}
                  {activeUsers.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-gray-500 text-white text-xs flex items-center justify-center border-2 border-white">
                      +{activeUsers.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-500">Version: {version}</div>
            {saving && (
              <span className="text-sm text-gray-500">Saving...</span>
            )}
            {!isOnline && (
              <span className="text-sm text-yellow-600">
                Offline - changes will sync when online
              </span>
            )}
            <button
              onClick={manualSave}
              disabled={saving || !isOnline}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Now"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 p-8">
        <textarea
          value={content}
          onChange={handleContentChange}
          className="w-full h-full p-4 border rounded font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Start typing... Changes are auto-saved and shared in real-time"
          disabled={connectionStatus === "connecting" && !content}
        />
      </div>

      {isOwner && (
        <div className="border-t p-4 bg-gray-50">
          <h3 className="font-semibold mb-2">Share Document</h3>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="User ID"
              className="flex-1 p-2 border rounded"
              id="shareUserId"
            />
            <select className="p-2 border rounded" id="sharePermission">
              <option value="VIEW">View</option>
              <option value="SUGGEST">Suggest</option>
              <option value="EDIT">Edit</option>
            </select>
            <button
              onClick={() => {
                const userId = document.getElementById("shareUserId").value;
                const permission =
                  document.getElementById("sharePermission").value;
                if (userId) handleShare(userId, permission);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentPage;