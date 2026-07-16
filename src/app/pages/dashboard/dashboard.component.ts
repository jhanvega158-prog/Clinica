import { Component, OnInit, signal } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { ToastService } from '../../core/services/toast.service';
import { DashboardCita, DashboardResumen } from '../../core/models/interfaces/database.types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  readonly loading = signal(false);
  readonly resumen = signal<DashboardResumen | null>(null);
  readonly citas = signal<DashboardCita[]>([]);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [resumen, citas] = await Promise.all([
        this.dashboardService.resumen(),
        this.dashboardService.citas()
      ]);
      this.resumen.set(resumen);
      this.citas.set(citas);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo cargar el dashboard');
    } finally {
      this.loading.set(false);
    }
  }
}
