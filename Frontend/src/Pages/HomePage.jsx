import { useNavigate } from "react-router-dom";
import { logout, getToken, getCurrentUserId } from "../services/auth";
import { useState, useEffect } from "react";

const BASE_URL = "https://api.pinnacle-hub.nabindhakal10.com.np";

const HomePage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("name");
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingItem, setRenamingItem] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const currentUserId = getCurrentUserId();

  useEffect(() => {
    fetchItems();
  }, [currentFolderId]);

  useEffect(() => {
    if (currentFolderId) {
      fetchFolderPath();
    } else {
      setFolderPath([]);
    }
  }, [currentFolderId]);

  const fetchFolderPath = async () => {
    try {
      const token = getToken();
      let folderId = currentFolderId;
      const path = [];
      
      while (folderId) {
        const response = await fetch(`${BASE_URL}/files/${folderId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) break;
        
        const folderData = await response.json();
        path.unshift({ id: folderData.id, name: folderData.name, parent_id: folderData.parent_id });
        folderId = folderData.parent_id;
      }
      
      setFolderPath(path);
    } catch (error) {
      console.error("Failed to fetch folder path:", error);
    }
  };

  const fetchItems = async () => {
  try {
    setLoading(true);
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

    const allFiles = await response.json();
    
    let visibleItems;
    
    if (currentFolderId) {
      visibleItems = allFiles.filter(file => 
        file.parent_id === currentFolderId
      );
    } else {
      visibleItems = allFiles.filter(file => {
        if (file.parent_id === null) return true;
        if (file.parent_accessible === true) return false;
        return true;
      });
    }
    
    setItems(visibleItems);
    setError(null);
  } catch (error) {
    console.error("Failed to fetch items:", error);
    setError("Failed to load items");
    setItems([]);
  } finally {
    setLoading(false);
  }
};

  const navigateToFolder = (folder) => {
    setCurrentFolderId(folder.id);
  };

  const navigateToParent = () => {
    if (folderPath.length > 0) {
      const parentId = folderPath[0].parent_id;
      setCurrentFolderId(parentId || null);
    } else {
      setCurrentFolderId(null);
    }
  };

  const navigateToBreadcrumb = (index) => {
    if (index === -1) {
      setCurrentFolderId(null);
    } else {
      setCurrentFolderId(folderPath[index].id);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const token = getToken();

      const response = await fetch(`${BASE_URL}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          type: "FOLDER",
          parent_id: currentFolderId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setNewFolderName("");
      setShowNewFolderModal(false);
      fetchItems();
    } catch (error) {
      console.error("Failed to create folder:", error);
      setError("Failed to create folder");
    }
  };

  const createDocument = async () => {
    try {
      const token = getToken();
      const docName = newDocName.trim() || "Untitled Document";

      const response = await fetch(`${BASE_URL}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: docName,
          type: "FILE",
          parent_id: currentFolderId,
          content: { text: { text: "" } }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newDoc = await response.json();
      setNewDocName("");
      setShowNewDocModal(false);
      navigate(`/docs/${newDoc.id}`);
    } catch (error) {
      console.error("Failed to create document:", error);
      setError("Failed to create document");
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;

    try {
      const token = getToken();

      const response = await fetch(`${BASE_URL}/files/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      fetchItems();
      setContextMenu(null);
    } catch (error) {
      console.error("Failed to delete item:", error);
      setError("Failed to delete item");
    }
  };

  const renameItem = async () => {
    if (!renameValue.trim() || renameValue === renamingItem.name) {
      setRenamingItem(null);
      return;
    }

    try {
      const token = getToken();

      const response = await fetch(`${BASE_URL}/files/${renamingItem.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: renameValue.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setRenamingItem(null);
      fetchItems();
    } catch (error) {
      console.error("Failed to rename item:", error);
      setError("Failed to rename item");
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

  const filteredItems = items
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "type") {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'FOLDER' ? -1 : 1;
      } else {
        return new Date(b.updated_at) - new Date(a.updated_at);
      }
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
            <div className="flex items-center space-x-2 mt-1 text-sm">
              <button
                onClick={() => navigateToBreadcrumb(-1)}
                className={`hover:text-blue-600 ${!currentFolderId ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
              >
                Home
              </button>
              {folderPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center space-x-2">
                  <span className="text-gray-400">/</span>
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className="text-gray-500 hover:text-blue-600"
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-5 5h10a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>New folder</span>
            </button>
            <button
              onClick={() => setShowNewDocModal(true)}
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

        <div className="flex items-center justify-between mb-6">
          <div className="relative w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Sort by name</option>
              <option value="date">Sort by date</option>
              <option value="type">Sort by type</option>
            </select>

            <div className="flex items-center space-x-1 border border-gray-300 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {currentFolderId && (
          <button
            onClick={navigateToParent}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Go back</span>
          </button>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Folder is empty</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm ? "No matches found" : "Create a new document or folder to get started"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.pageX, y: e.pageY, item });
                }}
                className="relative"
              >
                {renamingItem?.id === item.id ? (
                  <div className="bg-white rounded-lg border border-blue-500 p-4">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameItem();
                        if (e.key === "Escape") setRenamingItem(null);
                      }}
                      onBlur={renameItem}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div
                    onClick={() => item.type === 'FOLDER' ? navigateToFolder(item) : navigate(`/docs/${item.id}`)}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      {item.type === 'FOLDER' ? (
                        <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      {item.owner_id !== currentUserId && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          Shared
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1 truncate">{item.name}</h3>
                    <p className="text-xs text-gray-500">
                      {item.type === 'FOLDER' ? 'Folder' : 'Document'} • Updated {new Date(item.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map(item => (
                  <tr
                    key={item.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.pageX, y: e.pageY, item });
                    }}
                    onClick={() => item.type === 'FOLDER' ? navigateToFolder(item) : navigate(`/docs/${item.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {item.type === 'FOLDER' ? (
                          <svg className="w-5 h-5 text-yellow-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        <span className="text-sm text-gray-900">{item.name}</span>
                        {item.owner_id !== currentUserId && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            Shared
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.type === 'FOLDER' ? 'Folder' : 'Document'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {contextMenu && (
          <>
            <div
              className="fixed inset-0"
              onClick={() => setContextMenu(null)}
            />
            <div
              className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              <button
                onClick={() => {
                  setRenamingItem(contextMenu.item);
                  setRenameValue(contextMenu.item.name);
                  setContextMenu(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Rename
              </button>
              <button
                onClick={() => deleteItem(contextMenu.item)}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Delete
              </button>
            </div>
          </>
        )}

        {showNewFolderModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-medium mb-4">Create new folder</h3>
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={createFolder}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewFolderModal(false);
                    setNewFolderName("");
                  }}
                  className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showNewDocModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-medium mb-4">Create new document</h3>
              <input
                type="text"
                placeholder="Document name (optional)"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createDocument()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={createDocument}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewDocModal(false);
                    setNewDocName("");
                  }}
                  className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;