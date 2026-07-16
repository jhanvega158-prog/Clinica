import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'pacientes', loadComponent: () => import('./pages/pacientes/pacientes.component').then((m) => m.PacientesComponent) },
      { path: 'historia-clinica', loadComponent: () => import('./pages/historia-clinica/historia-clinica.component').then((m) => m.HistoriaClinicaComponent) },
      { path: 'agenda', loadComponent: () => import('./pages/agenda/agenda.component').then((m) => m.AgendaComponent) },
      { path: 'odontograma', loadComponent: () => import('./pages/odontograma/odontograma.component').then((m) => m.OdontogramaComponent) },
      { path: 'tratamientos', loadComponent: () => import('./pages/tratamientos/tratamientos.component').then((m) => m.TratamientosComponent) },
      { path: 'facturacion', loadComponent: () => import('./pages/facturacion/facturacion.component').then((m) => m.FacturacionComponent) },
      { path: 'inventario', loadComponent: () => import('./pages/inventario/inventario.component').then((m) => m.InventarioComponent) },
      { path: 'reportes', loadComponent: () => import('./pages/reportes/reportes.component').then((m) => m.ReportesComponent) }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
