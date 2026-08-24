import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { EstadoCita, Factura, Inventario, Tratamiento } from '../../core/models/interfaces/database.types';
import { ReporteCita, ReporteDatos, ReporteFiltros, ReportesService } from '../../core/services/reportes.service';
import { ToastService } from '../../core/services/toast.service';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type MonthPoint = { key: string; label: string; total: number; estados: Record<string, number> };
type Ranked = { nombre: string; cantidad: number };

@Component({ selector: 'app-reportes', standalone: true, imports: [ReactiveFormsModule], templateUrl: './reportes.component.html', styleUrl: './reportes.component.css' })
export class ReportesComponent implements OnInit {
  private readonly fb = inject(FormBuilder); private readonly service = inject(ReportesService); private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false); readonly generatingPdf = signal(false); readonly data = signal<ReporteDatos | null>(null);
  readonly applied = signal<ReporteFiltros>(this.defaultPeriod());
  readonly form = this.fb.nonNullable.group({ ...this.defaultPeriod() });
  readonly citasTabla = signal<ReporteCita[]>([]); readonly loadingCitas = signal(false);
  readonly citasForm = this.fb.nonNullable.group({ periodo: ['month'], estado: [''], paciente: [''], desde: [''], hasta: [''] });
  readonly estados: EstadoCita[] = ['pendiente', 'confirmada', 'atendida', 'cancelada', 'reagendada', 'no_asistio'];
  readonly citas = computed(() => this.data()?.citas ?? []); readonly facturas = computed(() => this.data()?.facturas ?? []);
  readonly stockBajo = computed(() => (this.data()?.inventario ?? []).filter((i) => Number(i.stock) <= Number(i.stock_minimo)));
  readonly pacientesActivos = computed(() => (this.data()?.pacientes ?? []).filter((p) => p.activo).length);
  readonly pacientesNuevos = computed(() => (this.data()?.pacientes ?? []).filter((p) => p.created_at && p.created_at.slice(0, 10) >= this.applied().desde && p.created_at.slice(0, 10) <= this.applied().hasta).length);
  readonly tratamientosPendientes = computed(() => (this.data()?.tratamientos ?? []).filter((t) => ['pendiente', 'activo'].includes(t.estado)).length);
  readonly totalFacturado = computed(() => this.sumInvoices(this.facturas().filter((f) => f.estado !== 'anulado')));
  readonly totalCobrado = computed(() => this.sumInvoices(this.facturas().filter((f) => f.estado === 'completado')));
  readonly totalPendiente = computed(() => this.sumInvoices(this.facturas().filter((f) => f.estado === 'pendiente')));
  readonly ticketPromedio = computed(() => { const valid = this.facturas().filter((f) => f.estado !== 'anulado'); return valid.length ? this.totalFacturado() / valid.length : 0; });
  readonly atendidas = computed(() => this.citas().filter((c) => c.estado === 'atendida').length);
  readonly citasPorMes = computed<MonthPoint[]>(() => this.months().map((month) => { const citas = this.citas().filter((c) => c.fecha.startsWith(month.key)); const estados: Record<string, number> = {}; this.estados.forEach((e) => estados[e] = citas.filter((c) => c.estado === e).length); return { ...month, total: citas.length, estados }; }));
  readonly ingresosPorMes = computed(() => this.months().map((m) => ({ ...m, total: this.sumInvoices(this.facturas().filter((f) => f.estado !== 'anulado' && f.fecha.startsWith(m.key))) })));
  readonly estadoCitas = computed(() => this.estados.map((estado) => ({ estado, cantidad: this.citas().filter((c) => c.estado === estado).length })).filter((x) => x.cantidad));
  readonly tratamientosTop = computed<Ranked[]>(() => { const counts = new Map<string, number>(); (this.data()?.tratamientos ?? []).forEach((t: Tratamiento) => { const name = t.procedimiento.trim(); if (name) counts.set(name, (counts.get(name) ?? 0) + 1); }); return [...counts].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8); });
  readonly maxCitas = computed(() => Math.max(1, ...this.citasPorMes().map((x) => x.total))); readonly maxIngresos = computed(() => Math.max(1, ...this.ingresosPorMes().map((x) => x.total))); readonly maxTratamiento = computed(() => Math.max(1, ...this.tratamientosTop().map((x) => x.cantidad)));
  readonly tieneCitasMensuales = computed(() => this.citasPorMes().some((x) => x.total > 0));
  readonly tieneIngresosMensuales = computed(() => this.ingresosPorMes().some((x) => x.total > 0));

  ngOnInit(): void { this.setCitasPeriod('month'); this.citasForm.valueChanges.pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.cargarCitasTabla()); void this.aplicarFiltros(); }
  async aplicarFiltros(): Promise<void> { const raw = this.form.getRawValue(); if (raw.desde > raw.hasta) { this.toast.error('La fecha desde no puede ser posterior a la fecha hasta.'); return; } this.applied.set(raw); await this.load(); }
  async load(): Promise<void> { if (this.loading()) return; this.loading.set(true); try { this.data.set(await this.service.cargar(this.applied())); } catch (error) { console.error('No se pudieron cargar los reportes:', error); this.toast.error('No se pudieron cargar los reportes. Intente nuevamente.'); } finally { this.loading.set(false); } }
  async cargarCitasTabla(): Promise<void> { const raw = this.citasForm.getRawValue(); if (!raw.desde || !raw.hasta || raw.desde > raw.hasta) return; this.loadingCitas.set(true); try { this.citasTabla.set(await this.service.cargarCitasTabla({ desde: raw.desde, hasta: raw.hasta, estado: raw.estado, paciente: raw.paciente })); } catch (error) { console.error('No se pudo cargar la tabla de citas:', error); this.toast.error('No se pudieron cargar las citas. Intente nuevamente.'); } finally { this.loadingCitas.set(false); } }
  changeCitasPeriod(): void { this.setCitasPeriod(this.citasForm.controls.periodo.value); }
  quick(period: 'today'|'month'|'quarter'|'year'): void { const now = new Date(); const end = this.iso(now); let start = end; if (period === 'month') start = this.iso(new Date(now.getFullYear(), now.getMonth(), 1)); if (period === 'quarter') start = this.iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)); if (period === 'year') start = `${now.getFullYear()}-01-01`; this.form.patchValue({ desde: start, hasta: end }); void this.aplicarFiltros(); }
  async generarPdf(): Promise<void> { const element = document.getElementById('reporte-pdf'); if (!element || this.generatingPdf()) return; this.generatingPdf.set(true); element.classList.add('pdf-capture'); try { const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#fff', useCORS: true, logging: false }); const pdf = new jsPDF('p', 'mm', 'a4'); const margin = 8, width = pdf.internal.pageSize.getWidth() - margin * 2, pageHeight = pdf.internal.pageSize.getHeight() - margin * 2; const imageHeight = canvas.height * width / canvas.width; const image = canvas.toDataURL('image/jpeg', .94); let y = 0; while (y < imageHeight) { if (y) pdf.addPage(); pdf.addImage(image, 'JPEG', margin, margin - y, width, imageHeight, undefined, 'FAST'); y += pageHeight; } pdf.save(`Reporte_VitaDenti_${this.applied().desde}_${this.applied().hasta}.pdf`); } catch (error) { console.error('Error generando PDF:', error); this.toast.error('No se pudo generar el PDF.'); } finally { element.classList.remove('pdf-capture'); this.generatingPdf.set(false); } }
  currency(value: number): string { return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value); }
  stateLabel(value: string): string { return ({ pendiente:'Pendiente', confirmada:'Confirmada', atendida:'Atendida', cancelada:'Cancelada', reagendada:'Reagendada', no_asistio:'No asistió' } as Record<string,string>)[value] ?? value; }
  stockState(item: Inventario): string { if (Number(item.stock) <= 0) return 'Sin stock'; if (Number(item.stock) <= Number(item.stock_minimo) * .5) return 'Crítico'; return 'Stock bajo'; }
  odontologoSeleccionado(): string { const id = this.applied().odontologoId; if (!id) return 'Todos'; const u = this.data()?.odontologos.find((x) => x.id === id); return u ? `${u.nombres} ${u.apellidos}` : 'Todos'; }
  generatedAt(): string { return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()); }
  private setCitasPeriod(period: string): void { if (period === 'custom') return; const now = new Date(); const hasta = this.iso(now); let desde = hasta; if (period === 'week') { const day = (now.getDay() + 6) % 7; desde = this.iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)); } if (period === 'month') desde = this.iso(new Date(now.getFullYear(), now.getMonth(), 1)); this.citasForm.patchValue({ desde, hasta }, { emitEvent: false }); void this.cargarCitasTabla(); }
  private sumInvoices(items: Factura[]): number { return Math.round(items.reduce((sum, f) => sum + Number(f.total || 0), 0) * 100) / 100; }
  private months(): Array<{key:string;label:string}> { const { desde, hasta } = this.applied(); const start = new Date(`${desde}T00:00:00`), end = new Date(`${hasta}T00:00:00`), result=[]; for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth()+1, 1)) result.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: new Intl.DateTimeFormat('es-EC',{month:'short',year:'2-digit'}).format(d) }); return result; }
  private defaultPeriod(): ReporteFiltros { const now = new Date(); return { desde: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, hasta: this.iso(now), odontologoId: '', estado: '' }; }
  private iso(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
}
