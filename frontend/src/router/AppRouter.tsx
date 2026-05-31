// frontend/src/router/AppRouter.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import ProtectedRoute from './ProtectedRoute'
import Login from '../pages/Login'
import NotAuthorized from '../pages/NotAuthorized'
import AdminLayout from '../components/admin/AdminLayout'

const POS = lazy(() => import('../pages/POS'))
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'))
const AdminProducts = lazy(() => import('../pages/admin/Products'))
const AdminUsers = lazy(() => import('../pages/admin/Users'))
const AdminBags = lazy(() => import('../pages/admin/Bags'))
const AdminSales = lazy(() => import('../pages/admin/Sales'))

export default function AppRouter() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#aaa' }}>Načítám…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/403" element={<NotAuthorized />} />

        <Route
          path="/pos"
          element={
            <ProtectedRoute requiredRole="prodavacka">
              <POS />
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
          <Route path="products" element={<AdminProducts />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="bags" element={<AdminBags />} />
          <Route path="sales" element={<AdminSales />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
