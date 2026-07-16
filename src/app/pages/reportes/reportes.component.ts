import { Component, OnInit, signal } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { InventarioService } from '../../core/services/inventario.service';
import { ToastService } from '../../core/services/toast.service';
import { DashboardCita, DashboardResumen, Inventario } from '../../core/models/interfaces/database.types';

@Component({
  selector: 'app-reportes',
  standalone: true,
  templateUrl: './reportes.component.html'
})
export class ReportesComponent implements OnInit {
  readonly resumen = signal<DashboardResumen | null>(null);
  readonly citas = signal<DashboardCita[]>([]);
  readonly stockBajo = signal<Inventario[]>([]);
  readonly loading = signal(false);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly inventarioService: InventarioService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [resumen, citas, stockBajo] = await Promise.all([
        this.dashboardService.resumen(),
        this.dashboardService.citas(),
        this.inventarioService.bajoStock()
      ]);
      this.resumen.set(resumen);
      this.citas.set(citas);
      this.stockBajo.set(stockBajo);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudieron generar reportes');
    } finally {
      this.loading.set(false);
    }
  }

  print(): void {
    window.print();
  }
}
