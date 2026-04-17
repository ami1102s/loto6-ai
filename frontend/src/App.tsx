import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header.tsx";
import { Footer } from "./components/Footer.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { FrequencyPage } from "./pages/FrequencyPage.tsx";
import { PatternPage } from "./pages/PatternPage.tsx";
import { PredictPage } from "./pages/PredictPage.tsx";
import { SimulationPage } from "./pages/SimulationPage.tsx";
import { DrawsPage } from "./pages/DrawsPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/frequency" element={<FrequencyPage />} />
            <Route path="/patterns" element={<PatternPage />} />
            <Route path="/predict" element={<PredictPage />} />
            <Route path="/simulation" element={<SimulationPage />} />
            <Route path="/draws" element={<DrawsPage />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
