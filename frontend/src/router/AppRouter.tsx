// frontend/src/router/AppRouter.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import ProtectedRoute from './ProtectedRoute'
import Login from '../pages/Login'
import NotAuthorized from '../pages/NotAuthorized'
import AdminLayout from '../components/admin/AdminLayout'

const CajovnaPOS = lazy(() => import('../pages/CajovnaPOS'))
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'))
const AdminItems = lazy(() => import('../pages/admin/Items'))
const AdminCategories = lazy(() => import('../pages/admin/Categories'))
const AdminUsers = lazy(() => import('../pages/admin/Users'))
const AdminBags = lazy(() => import('../pages/admin/Bags'))
const AdminSales = lazy(() => import('../pages/admin/Sales'))
const AdminProdukty = lazy(() => import('../pages/admin/ProduktyAdmin'))
const AdminKasa = lazy(() => import('../pages/admin/Kasa'))

export default function AppRouter() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#aaa' }}>Načítám…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/403" element={<NotAuthorized />} />

        <Route
          path="/cajovna"
          element={
            <ProtectedRoute requiredRole="prodavacka">
              <CajovnaPOS />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminItems />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="bags" element={<AdminBags />} />
          <Route path="sales" element={<AdminSales />} />
          <Route path="teas" element={<AdminProdukty produktTyp="caje" nadpis="Čaje" />} />
          <Route path="nadobi" element={<AdminProdukty produktTyp="nadobi" nadpis="Nádobí" />} />
          <Route path="etnoshop" element={<AdminProdukty produktTyp="etnoshop" nadpis="Etnoshop" />} />
          <Route path="kasa" element={<AdminKasa />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
