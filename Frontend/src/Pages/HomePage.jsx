import { useNavigate } from "react-router-dom";
import { logout, getToken } from "../services/auth";
import { useState, useEffect } from "react";

const BASE_URL = "http://localhost:8000";

const HomePage = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = getToken();
      
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

      if (response.status === 401) {
        await logout();
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDocuments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      setError("Failed to load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async () => {
    try {
      const token = getToken();

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

      if (response.status === 401) {
        await logout();
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newDoc = await response.json();
      navigate(`/docs/${newDoc.id}`);
    } catch (error) {
      console.error("Failed to create document:", error);
      setError("Failed to create document");
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

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={createDocument}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>New document</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Document grid */}
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No documents</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm ? "No matches found" : "Get started by creating a new document"}
            </p>
            {!searchTerm && (
              <button
                onClick={createDocument}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                New document
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                onClick={() => navigate(`/docs/${doc.id}`)}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-900 mb-1 truncate">{doc.name}</h3>
                <p className="text-xs text-gray-500">
                  Edited {new Date(doc.updated_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;