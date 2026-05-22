import { Route, Routes } from "react-router-dom";
import BoardDetailPage from "./pages/BoardDetailPage";
import HomePage from "./pages/HomePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/boards/:boardId" element={<BoardDetailPage />} />
    </Routes>
  );
}
