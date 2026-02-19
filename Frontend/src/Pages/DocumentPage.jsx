import { useParams, useNavigate } from "react-router-dom";
import { getToken } from "../services/auth";
import { useState, useEffect } from "react";

const BASE_URL = "http://localhost:8000";

const DocumentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      const token = getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(`${BASE_URL}/files/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        await logout();
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDocument(data);
      setContent(data.content || "");
      setError(null);
    } catch (error) {
      console.error("Failed to fetch document:", error);
      setError("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async () => {
    try {
      setSaving(true);
      const token = getToken();
      
      const response = await fetch(`${BASE_URL}/files/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedDoc = await response.json();
      setDocument(updatedDoc);
    } catch (error) {
      console.error("Failed to save document:", error);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async (userId, permission) => {
    try {
      const token = getToken();
      
      const response = await fetch(`${BASE_URL}/files/${id}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          permission: permission
        })
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

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/")}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold">{document?.name}</h1>
          {saving && <span className="text-sm text-gray-500">Saving...</span>}
        </div>
        <div className="space-x-2">
          <button
            onClick={saveDocument}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 p-8">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full p-4 border rounded font-mono"
          placeholder="Start typing..."
        />
      </div>

      {/* Share Modal (simplified - you can expand this) */}
      {document?.owner_id === document?.owner_id && (
        <div className="border-t p-4">
          <h3 className="font-semibold mb-2">Share Document</h3>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="User ID"
              className="flex-1 p-2 border rounded"
              id="shareUserId"
            />
            <select
              className="p-2 border rounded"
              id="sharePermission"
            >
              <option value="view">View</option>
              <option value="suggest">Suggest</option>
              <option value="edit">Edit</option>
            </select>
            <button
              onClick={() => {
                const userId = document.getElementById("shareUserId").value;
                const permission = document.getElementById("sharePermission").value;
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