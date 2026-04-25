import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Editor from "@/pages/Editor";
import Materials from "@/pages/Materials";
import Progetti from "@/pages/Progetti";
import Preventivi from "@/pages/Preventivi";
import NuovoPreventivo from "@/pages/NuovoPreventivo";
import PreventivoPacchetto from "@/pages/PreventivoPacchetto";
import PreventivoBagno from "@/pages/PreventivoBagno";
import PreventivoComposite from "@/pages/PreventivoComposite";
import PreventivoInfissi from "@/pages/PreventivoInfissi";
import ConfiguratoreEsigenze from "@/pages/ConfiguratoreEsigenze";
import Commesse from "@/pages/Commesse";
import DettaglioCommessa from "@/pages/DettaglioCommessa";
import CentroCosto from "@/pages/CentroCosto";
import CRM from "@/pages/CRM";
import DashboardCliente from "@/pages/DashboardCliente";
import DashboardSubappaltatore from "@/pages/DashboardSubappaltatore";
// admin
import AdminPacchetti from "@/pages/admin/AdminPacchetti";
import AdminOptional from "@/pages/admin/AdminOptional";
import AdminVociBackoffice from "@/pages/admin/AdminVociBackoffice";
import AdminFasiCommessa from "@/pages/admin/AdminFasiCommessa";
import AdminVenditori from "@/pages/admin/AdminVenditori";
import AdminSubappaltatori from "@/pages/admin/AdminSubappaltatori";
import AdminNegozi from "@/pages/admin/AdminNegozi";
import AdminReportBudget from "@/pages/admin/AdminReportBudget";
import AdminTemplateEmail from "@/pages/admin/AdminTemplateEmail";
import AdminUtenti from "@/pages/admin/AdminUtenti";
import AdminDatiAzienda from "@/pages/admin/AdminDatiAzienda";
import AdminImpostazioni from "@/pages/admin/AdminImpostazioni";
import DashboardSubappaltatori from "@/pages/DashboardSubappaltatori";
import SubappaltatoreDettaglio from "@/pages/SubappaltatoreDettaglio";
import GestoreCantieri from "@/pages/GestoreCantieri";
import PortaleCliente from "@/pages/PortaleCliente";
import PortaleClienteLogin from "@/pages/PortaleClienteLogin";
import PortaleSub from "@/pages/PortaleSub";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

const P = (Comp) => (
  <ProtectedRoute>
    <AppLayout>
      <Comp />
    </AppLayout>
  </ProtectedRoute>
);

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Main */}
            <Route path="/dashboard" element={P(Dashboard)} />
            <Route path="/dashboardcliente" element={P(DashboardCliente)} />
            <Route path="/dashboardsubappaltatore" element={P(DashboardSubappaltatore)} />
            {/* Preventivi */}
            <Route path="/nuovopreventivo" element={P(NuovoPreventivo)} />
            <Route path="/preventivi" element={P(Preventivi)} />
            <Route path="/preventivopacchetto" element={P(PreventivoPacchetto)} />
            <Route path="/preventivopacchetto/:id" element={P(PreventivoPacchetto)} />
            <Route path="/preventivobagno" element={P(PreventivoBagno)} />
            <Route path="/preventivobagno/:id" element={P(PreventivoBagno)} />
            <Route path="/preventivocomposite" element={P(PreventivoComposite)} />
            <Route path="/preventivocomposite/:id" element={P(PreventivoComposite)} />
            <Route path="/preventivoinfissi" element={P(PreventivoInfissi)} />
            <Route path="/preventivoinfissi/:id" element={P(PreventivoInfissi)} />
            <Route path="/configuratoreesigenze" element={P(ConfiguratoreEsigenze)} />
            {/* Commesse */}
            <Route path="/commesse" element={P(Commesse)} />
            <Route path="/dettagliocommessa/:id" element={P(DettaglioCommessa)} />
            <Route path="/centrocosto" element={P(CentroCosto)} />
            <Route path="/crm" element={P(CRM)} />
            {/* Progettazione CAD (plus) */}
            <Route path="/progetti" element={P(Progetti)} />
            <Route path="/editor/:id" element={P(Editor)} />
            <Route path="/materials" element={P(Materials)} />
            {/* Admin */}
            <Route path="/adminpacchetti" element={P(AdminPacchetti)} />
            <Route path="/adminoptional" element={P(AdminOptional)} />
            <Route path="/adminvocibackoffice" element={P(AdminVociBackoffice)} />
            <Route path="/adminfasicommessa" element={P(AdminFasiCommessa)} />
            <Route path="/adminvenditori" element={P(AdminVenditori)} />
            <Route path="/adminsubappaltatori" element={P(AdminSubappaltatori)} />
            <Route path="/adminnegozi" element={P(AdminNegozi)} />
            <Route path="/adminreportbudget" element={P(AdminReportBudget)} />
            <Route path="/admintemplateemail" element={P(AdminTemplateEmail)} />
            <Route path="/adminutenti" element={P(AdminUtenti)} />
            <Route path="/admindatiazienda" element={P(AdminDatiAzienda)} />
            <Route path="/adminimpostazioni" element={P(AdminImpostazioni)} />
            {/* Round 10: Cantieri / Subappaltatori / Portale Cliente */}
            <Route path="/dashboard-subappaltatori" element={P(DashboardSubappaltatori)} />
            <Route path="/subappaltatori/:id" element={P(SubappaltatoreDettaglio)} />
            <Route path="/gestore-cantieri" element={P(GestoreCantieri)} />
            <Route path="/portale-sub" element={P(PortaleSub)} />
            <Route path="/portale-cliente" element={P(PortaleCliente)} />
            <Route path="/portale-cliente/login" element={<PortaleClienteLogin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
