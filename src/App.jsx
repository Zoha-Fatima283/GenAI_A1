import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import UniversalRestoration from "./pages/UniversalRestoration";
import HardRouted from "./pages/HardRouted";
import SoftMoE from "./pages/SoftMoE";
import FaceToSketch from "./pages/FaceToSketch";

function App() {
  return (
    <Routes>

      <Route element={<Layout />}>

        <Route
          path="/universal"
          element={<UniversalRestoration />}
        />

        <Route
          path="/hard-routed"
          element={<HardRouted />}
        />

        <Route
          path="/soft-moe"
          element={<SoftMoE />}
        />

        <Route
          path="/face-to-sketch"
          element={<FaceToSketch />}
        />

      </Route>

      <Route
        path="*"
        element={<Navigate to="/universal" replace />}
      />

    </Routes>
  );
}

export default App;