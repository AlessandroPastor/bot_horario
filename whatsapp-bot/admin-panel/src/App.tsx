import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { CalendarioPage } from "./pages/Calendario";
import { CursosPage } from "./pages/Cursos";
import { DashboardPage } from "./pages/Dashboard";
import { DocentesPage } from "./pages/Docentes";
import { HorariosPage } from "./pages/Horarios";
import { LoginPage } from "./pages/Login";
import { ReunionesPage } from "./pages/Reuniones";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/docentes" element={<DocentesPage />} />
          <Route path="/cursos" element={<CursosPage />} />
          <Route path="/horarios" element={<HorariosPage />} />
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="/reuniones" element={<ReunionesPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
