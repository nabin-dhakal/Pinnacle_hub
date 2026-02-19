import { useNavigate } from "react-router-dom";
import { logout, getToken } from "../services/auth";
import { useState, useEffect } from "react";

const BASE_URL = "http://localhost:8000";

const HomePage = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = getToken();
      console.log("Fetching documents with token:", token ? "Token exists" : "No token");
      
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(`${BASE_URL}/files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log("Response status:", response.status);

      if (response.status === 401) {
        console.log("Unauthorized - redirecting to login");
        await logout();
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Documents received:", data);
      setDocuments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      setError("Failed to load documents. Please try again.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async () => {
    try {
      const token = getToken();
      console.log("Creating document with token:", token ? "Token exists" : "No token");

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(`${BASE_URL}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: "Untitled Document",
          type: "FILE"
        })
      });

      console.log("Create response status:", response.status);

      if (response.status === 401) {
        console.log("Unauthorized - redirecting to login");
        await logout();
        navigate("/login");
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newDoc = await response.json();
      console.log("New document created:", newDoc);
      navigate(`/docs/${newDoc.id}`);
    } catch (error) {
      console.error("Failed to create document:", error);
      setError("Failed to create document. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Documents</h1>
        <div className="space-x-4">
          <button
            onClick={createDocument}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            + New Document
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No documents yet.</p>
          <p className="text-gray-400">Click "New Document" to create your first document.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {documents.map(doc => (
            <div
              key={doc.id}
              onClick={() => navigate(`/docs/${doc.id}`)}
              className="p-4 border rounded cursor-pointer hover:shadow-lg transition"
            >
              <h3 className="font-semibold text-lg mb-2">{doc.name}</h3>
              <p className="text-sm text-gray-500">
                Updated: {new Date(doc.updated_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;