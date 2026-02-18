import { BrowserRouter, Routes, Route } from "react-router-dom";
import Files from "./Pages/Files";
import HomePage from "./Pages/HomePage";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import NotFound from "./Pages/NotFound";
import PrivateRoute from "./Pages/PrivateRoute";
import {logout} from "./services/auth"

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
          path="/files"
          element={
            <PrivateRoute>
              <Files />
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
