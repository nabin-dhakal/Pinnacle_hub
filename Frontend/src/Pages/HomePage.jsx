import { useNavigate } from "react-router-dom";
import {logout} from "../services/auth";

const BASE_URL = "http://localhost:8000";

const HomePage = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">Welcome to the Home Page</h1>
      <p className="text-lg mb-6">You are logged in!</p>
      <button
        onClick={handleLogout}
        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
      >
        Logout
      </button>
    </div>
  );
};

export default HomePage;
