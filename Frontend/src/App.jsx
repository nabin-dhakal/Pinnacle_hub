import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./Pages/HomePage";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import NotFound from "./Pages/NotFound";
import PrivateRoute from "./Pages/PrivateRoute";
import OAuthCallback from "./Pages/OAuthCallback";
import DocumentPage from "./Pages/DocumentPage";

function App() {


  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />

        <Route
        path="/oauth-callback" 
        element={<OAuthCallback />} 
        />
        
        <Route
          path="/docs/:id"
          element={
            <PrivateRoute>
              < DocumentPage />
            </PrivateRoute>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
