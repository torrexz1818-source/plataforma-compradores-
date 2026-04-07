import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import BuyerLayout from "./buyer/BuyerLayout.tsx";
import BuyerDashboard from "./buyer/BuyerDashboard.tsx";
import DirectoryPage from "./buyer/DirectoryPage.tsx";
import SectorSuppliers from "./buyer/SectorSuppliers.tsx";
import SupplierProfile from "./buyer/SupplierProfile.tsx";
import SalePage from "./buyer/SalePage.tsx";
import SaleDetailPage from "./buyer/SaleDetailPage.tsx";
import UserProfilePage from "./buyer/UserProfilePage.tsx";
import SupplierLayout from "./supplier/SupplierLayout.tsx";
import SupplierDashboard from "./supplier/SupplierDashboard.tsx";
import BuyerDirectoryPage from "./supplier/BuyerDirectoryPage.tsx";
import SectorBuyers from "./supplier/SectorBuyers.tsx";
import SupplierPosts from "./supplier/SupplierPosts.tsx";
import EditSupplierPublication from "./supplier/EditSupplierPublication.tsx";
import Community from "./buyer/Community.tsx";
import CommunityPostDetail from "./buyer/CommunityPostDetail.tsx";
import Index from "./pages/Index.tsx";
import PostDetail from "./pages/PostDetail.tsx";
import Landing from "./pages/Landing.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import Admin from "./pages/Admin.tsx";
import Notifications from "./pages/Notifications.tsx";
import EducationalContent from "./pages/EducationalContent.tsx";
import Messages from "./pages/Messages.tsx";
import Reports from "./pages/Reports.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const FullScreenMessage = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
    {message}
  </div>
);

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenMessage message="Cargando..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const GuestOnly = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenMessage message="Cargando..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

const PublicHome = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenMessage message="Cargando..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return <Landing />;
};

const DashboardRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenMessage message="Cargando..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'supplier') {
    return <Navigate to="/supplier/dashboard" replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/buyer/dashboard" replace />;
};

const ProfileLayoutRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenMessage message="Cargando..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'supplier') {
    return <SupplierLayout />;
  }

  if (user.role === 'buyer') {
    return <BuyerLayout />;
  }

  return <Navigate to="/admin/dashboard" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicHome />} />
            <Route path="/home" element={<DashboardRedirect />} />
            <Route
              path="/buyer"
              element={
                <ProtectedRoute role="buyer">
                  <BuyerLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<BuyerDashboard />} />
              <Route path="directory" element={<DirectoryPage />} />
              <Route path="directory/:sector" element={<SectorSuppliers />} />
              <Route path="supplier/:id" element={<SupplierProfile />} />
              <Route path="user/:role/:id" element={<UserProfilePage />} />
              <Route path="sale" element={<SalePage />} />
              <Route path="sale/:id" element={<SaleDetailPage />} />
              <Route path="community/post/:id" element={<CommunityPostDetail />} />
              <Route path="community" element={<Navigate to="/community" replace />} />
            </Route>
            <Route
              path="/supplier"
              element={
                <ProtectedRoute role="supplier">
                  <SupplierLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<SupplierDashboard />} />
              <Route path="directory" element={<BuyerDirectoryPage />} />
              <Route path="directory/:sector" element={<SectorBuyers />} />
              <Route path="posts" element={<Navigate to="/publicaciones" replace />} />
            </Route>
            <Route
              path="/publicaciones"
              element={
                <ProtectedRoute role="supplier">
                  <SupplierLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SupplierPosts />} />
              <Route path="edit/:id" element={<EditSupplierPublication />} />
            </Route>
            <Route
              path="/community"
              element={
                <ProtectedRoute role="buyer">
                  <Community />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contenido-educativo"
              element={
                <ProtectedRoute role="buyer">
                  <BuyerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EducationalContent />} />
            </Route>
            <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="/notificaciones" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="/reportes" element={<RequireAuth><Reports /></RequireAuth>} />
            <Route path="/mensajes" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route
              path="/directorio-proveedores"
              element={
                <ProtectedRoute role="buyer">
                  <BuyerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DirectoryPage />} />
              <Route path=":sector" element={<SectorSuppliers />} />
            </Route>
            <Route
              path="/directorio-compradores"
              element={
                <ProtectedRoute role="supplier">
                  <SupplierLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<BuyerDirectoryPage />} />
              <Route path=":sector" element={<SectorBuyers />} />
            </Route>
            <Route
              path="/perfil"
              element={
                <RequireAuth>
                  <ProfileLayoutRedirect />
                </RequireAuth>
              }
            >
              <Route index element={<UserProfilePage />} />
              <Route path=":id" element={<UserProfilePage />} />
            </Route>
            <Route path="/post/:id" element={<RequireAuth><PostDetail /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
            <Route path="/admin/dashboard" element={<RequireAuth><Admin /></RequireAuth>} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
