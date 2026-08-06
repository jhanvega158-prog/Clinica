import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import {
  CpoResultado,
  EstadoRegistro,
  IndicadorSaludBucal,
  Odontograma,
  OdontogramaCpoManual,
  OdontogramaDetalle,
  OdontogramaDetalleInsert,
  OdontogramaInsert,
  PiezaExaminada
} from '../../core/models/interfaces/database.types';
import { OdontogramaService } from '../../core/services/odontograma.service';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';
import { HistoriaService } from '../../core/services/historia.service';
import { getSurfaceColor, getToothShape, getToothVisualState, parseSurfaceFindings, serializeSurfaceFindings, type FindingKind, type ToothSurface } from './odontograma-helpers';
import { ValidationFeedbackDirective } from '../../shared/directives/validation-feedback.directive';
import {
  allowedValues,
  ecuadorianCedula,
  emptyToNull,
  integerMin,
  maxTrimLength,
  normalizeWhitespace,
  notBlankOptional,
  requiredTrim
} from '../../shared/utils/validation.utils';

interface ToothViewModel {
  numero: number;
  label: string;
  quadrant: number;
  shape: 'square' | 'circle';
  detail: OdontogramaDetalle | null;
  selected: boolean;
  examined: boolean;
  visual: ReturnType<typeof getToothVisualState>;
}

@Component({
  selector: 'app-odontograma',
  standalone: true,
  imports: [ReactiveFormsModule, ValidationFeedbackDirective, NgTemplateOutlet],
  templateUrl: './odontograma.component.html',
  styleUrl: './odontograma.component.css'
})
export class OdontogramaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly odontogramaService = inject(OdontogramaService);
  private readonly pacientesService = inject(PacientesService);
  private readonly historiaService = inject(HistoriaService);
  private readonly toast = inject(ToastService);
  readonly odontogramas = signal<Odontograma[]>([]);
  readonly detalles = signal<OdontogramaDetalle[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly cpo = signal<CpoResultado | null>(null);
  readonly cpoManual = signal<OdontogramaCpoManual | null>(null);
  readonly indicadores = signal<IndicadorSaludBucal | null>(null);
  readonly piezasExaminadas = signal<number[]>([]);
  readonly loading = this.odontogramaService.loading;
  readonly pacientesPorId = signal<Map<string, string>>(new Map());
  readonly pacienteInfo = signal<string | null>(null);
  readonly pacienteError = signal<string | null>(null);
  readonly buscandoPaciente = signal(false);
  readonly selectedTooth = signal<number | null>(null);
  readonly selectedFinding = signal<FindingKind>('caries');
  readonly piezas = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38,55,54,53,52,51,61,62,63,64,65,85,84,83,82,81,71,72,73,74,75];
  readonly form = this.fb.nonNullable.group({ cedula: ['', [requiredTrim(), ecuadorianCedula()]], paciente_id: ['', Validators.required], historia_id: [''], tipo: ['inicial' as 'inicial' | 'evolucion', [Validators.required, allowedValues(['inicial', 'evolucion'] as const)]], estado: ['activo' as EstadoRegistro, [Validators.required, allowedValues(['activo', 'completado', 'anulado'] as const)]], observaciones: ['', [notBlankOptional(), maxTrimLength(500)]] });
  readonly detailForm = this.fb.nonNullable.group({ pieza: [11, [Validators.required, integerMin(11)]], superficie: ['', [notBlankOptional(), maxTrimLength(40)]], movilidad: [0, [Validators.min(0), Validators.max(3)]], recesion: [0, [Validators.min(0), Validators.max(9)]], notas: ['', [notBlankOptional(), maxTrimLength(300)]] });
  readonly cpoForm = this.fb.nonNullable.group({ cariadas: [0, [integerMin(0)]], perdidas: [0, [integerMin(0)]], obturadas: [0, [integerMin(0)]], ceo: [0, [integerMin(0)]], total: [0, [integerMin(0)]], observaciones: ['', [notBlankOptional(), maxTrimLength(300)]] });
  readonly indicadoresForm = this.fb.nonNullable.group({ higiene_placa: [false], higiene_calculo: [false], higiene_gingivitis: [false], periodontal_leve: [false], periodontal_moderada: [false], periodontal_severa: [false], oclusion_clase_i: [false], oclusion_clase_ii: [false], oclusion_clase_iii: [false], fluorosis_leve: [false], fluorosis_moderada: [false], fluorosis_severa: [false], observaciones: ['', [notBlankOptional(), maxTrimLength(300)]] });
  readonly findings = [
    { key: 'caries' as const, label: 'Caries', color: '#ef4444', description: 'Presencia de lesión cariosa' },
    { key: 'restauracion' as const, label: 'Restauración', color: '#3b82f6', description: 'Pieza restaurada' },
    { key: 'movilidad' as const, label: 'Movilidad', color: '#facc15', description: 'Movilidad periodontal' },
    { key: 'recesion' as const, label: 'Recesión', color: '#f97316', description: 'Recesión gingival' }
  ];
  readonly piezasExaminadasTabla = [
    [16, 17, 55],
    [11, 21, 51],
    [26, 27, 65],
    [36, 37, 75],
    [31, 41, 71],
    [46, 47, 85]
  ];

  readonly odontogramaView = computed<ToothViewModel[]>(() => this.piezas.map((numero) => {
    const detail = this.detalles().find((item) => item.pieza === numero) ?? null;
    return {
      numero,
      label: String(numero),
      quadrant: this.getQuadrant(numero),
      shape: getToothShape(numero),
      detail,
      selected: this.selectedTooth() === numero,
      examined: this.piezasExaminadas().includes(numero),
      visual: getToothVisualState(detail)
    };
  }));

  readonly quadrantView = computed(() => ({
    q1: this.odontogramaView().filter((item) => item.quadrant === 1),
    q2: this.odontogramaView().filter((item) => item.quadrant === 2),
    q3: this.odontogramaView().filter((item) => item.quadrant === 3),
    q4: this.odontogramaView().filter((item) => item.quadrant === 4),
    upperLeftTemporary: this.teethInOrder([55,54,53,52,51]),
    upperRightTemporary: this.teethInOrder([61,62,63,64,65]),
    lowerLeftTemporary: this.teethInOrder([85,84,83,82,81]),
    lowerRightTemporary: this.teethInOrder([71,72,73,74,75])
  }));

  readonly surfaces: ToothSurface[] = ['arriba', 'derecha', 'abajo', 'izquierda', 'centro'];
  readonly chartRows = computed(() => {
    const ordered = (numbers: number[]) => this.teethInOrder(numbers);
    return [
      { key: 'permanent-upper', label: 'Dentición permanente superior', temporary: false, left: ordered([18,17,16,15,14,13,12,11]), right: ordered([21,22,23,24,25,26,27,28]) },
      { key: 'temporary-upper', label: 'Dentición temporal superior', temporary: true, left: ordered([55,54,53,52,51]), right: ordered([61,62,63,64,65]) },
      { key: 'temporary-lower', label: 'Dentición temporal inferior', temporary: true, left: ordered([85,84,83,82,81]), right: ordered([71,72,73,74,75]) },
      { key: 'permanent-lower', label: 'Dentición permanente inferior', temporary: false, left: ordered([48,47,46,45,44,43,42,41]), right: ordered([31,32,33,34,35,36,37,38]) }
    ];
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    try {
      const [odontogramas, pacientes] = await Promise.all([
        this.odontogramaService.findAll({ orderBy: 'created_at', ascending: false }),
        this.pacientesService.findAll({ orderBy: 'apellidos', ascending: true })
      ]);
      this.odontogramas.set(odontogramas);
      this.pacientesPorId.set(new Map(pacientes.map((paciente) => [paciente.id, `${paciente.apellidos} ${paciente.nombres} (${paciente.cedula})`])));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se cargaron odontogramas');
    }
  }

  async select(item: Odontograma): Promise<void> {
    this.selectedId.set(item.id);
    const pacienteLabel = this.pacientesPorId().get(item.paciente_id) ?? '';
    const cedula = pacienteLabel.match(/\((\d{10})\)$/)?.[1] ?? '';
    this.form.patchValue({ cedula, paciente_id: item.paciente_id, historia_id: item.historia_id ?? '', tipo: item.tipo, estado: item.estado, observaciones: item.observaciones ?? '' });
    await this.loadDetails(item.id);
    await this.loadCpoManual(item.id);
    await this.loadIndicadores(item.historia_id ?? '');
    await this.loadPiezasExaminadas(item.historia_id ?? '');
    await this.calculate();
  }

  async loadDetails(id: string): Promise<void> {
    try { this.detalles.set(await this.odontogramaService.detalles(id)); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargaron detalles'); }
  }

  clear(): void {
    this.selectedId.set(null);
    this.detalles.set([]);
    this.selectedTooth.set(null);
    this.cpo.set(null);
    this.cpoManual.set(null);
    this.indicadores.set(null);
    this.piezasExaminadas.set([]);
    this.form.reset({ cedula: '', paciente_id: '', historia_id: '', tipo: 'inicial', estado: 'activo', observaciones: '' });
    this.cpoForm.reset({ cariadas: 0, perdidas: 0, obturadas: 0, ceo: 0, total: 0, observaciones: '' });
    this.indicadoresForm.reset({ higiene_placa: false, higiene_calculo: false, higiene_gingivitis: false, periodontal_leve: false, periodontal_moderada: false, periodontal_severa: false, oclusion_clase_i: false, oclusion_clase_ii: false, oclusion_clase_iii: false, fluorosis_leve: false, fluorosis_moderada: false, fluorosis_severa: false, observaciones: '' });
    this.detailForm.reset({ pieza: 11, superficie: '', movilidad: 0, recesion: 0, notas: '' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.detailForm.markAsPristine();
    this.detailForm.markAsUntouched();
    this.cpoForm.markAsPristine();
    this.cpoForm.markAsUntouched();
    this.indicadoresForm.markAsPristine();
    this.indicadoresForm.markAsUntouched();
    this.pacienteInfo.set(null);
    this.pacienteError.set(null);
  }

  async save(): Promise<void> {
    if (this.loading()) { return; }
    this.normalizeMainForm();
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    if (!raw.paciente_id) {
      this.pacienteError.set('Busca un paciente por cédula antes de guardar el odontograma.');
      return;
    }

    try {
      const { historiaId, odontogramaId } = await this.ensureContext();
      const payload: OdontogramaInsert = { paciente_id: raw.paciente_id, historia_id: historiaId, tipo: raw.tipo, estado: raw.estado, observaciones: emptyToNull(raw.observaciones) };
      const saved = await this.odontogramaService.update(odontogramaId, payload);
      this.selectedId.set(saved.id);
      this.form.patchValue({ historia_id: historiaId });
      this.toast.success('Odontograma guardado');
      await this.load();
      await this.loadDetails(saved.id);
      await this.loadCpoManual(saved.id);
      await this.loadIndicadores(historiaId);
      await this.loadPiezasExaminadas(historiaId);
      await this.calculate();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar odontograma'); }
  }

  async saveDetail(pieza?: number): Promise<void> {
    try {
      this.normalizeDetailForm();
      if (this.detailForm.invalid) { this.detailForm.markAllAsTouched(); return; }
      const { odontogramaId } = await this.ensureContext();
      const raw = this.detailForm.getRawValue();
    const selectedPieza = pieza ?? raw.pieza;
    if (!this.piezas.includes(selectedPieza)) {
      this.toast.error('Seleccione una pieza dental válida.');
      return;
    }
    if (this.currentDetail(selectedPieza) && !window.confirm('Esta pieza ya tiene un hallazgo. ¿Desea sobrescribirlo?')) {
      return;
    }
    this.selectedTooth.set(selectedPieza);
    this.detailForm.patchValue({ pieza: selectedPieza });
    const payload: OdontogramaDetalleInsert = {
      odontograma_id: odontogramaId,
      pieza: selectedPieza,
      superficie: emptyToNull(raw.superficie),
      condicion: this.buildConditionValue(selectedPieza),
      movilidad: Number(raw.movilidad) || null,
      recesion: Number(raw.recesion) || null,
      notas: emptyToNull(raw.notas)
    };

      await this.odontogramaService.guardarDetalle(payload);
      await this.loadDetails(odontogramaId);
      await this.calculate();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar hallazgo');
    }
  }

  async removeDetail(detalle: OdontogramaDetalle): Promise<void> {
    if (!window.confirm('¿Está seguro de eliminar este hallazgo?')) {
      return;
    }
    try {
      await this.odontogramaService.eliminarDetalle(detalle.id);
      const id = this.selectedId();
      if (id) { await this.loadDetails(id); await this.calculate(); }
      this.selectedTooth.set(null);
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar hallazgo'); }
  }

  async buscarPacientePorCedula(): Promise<void> {
    const cedula = normalizeWhitespace(this.form.controls.cedula.value);
    if (!cedula) {
      this.pacienteInfo.set(null);
      this.pacienteError.set(null);
      return;
    }

    this.buscandoPaciente.set(true);
    this.pacienteError.set(null);
    try {
      const result = await this.pacientesService.buscarPorCedulaConDetalles(cedula);
      if (!result.paciente) {
        this.form.patchValue({ paciente_id: '' });
        this.pacienteInfo.set(null);
        this.pacienteError.set('No existe un paciente registrado con esa cédula.');
        return;
      }

      this.form.patchValue({ paciente_id: result.paciente.id, cedula: result.paciente.cedula });
      const { historiaId, odontogramaId } = await this.ensureContext();
      this.form.patchValue({ historia_id: historiaId });
      this.selectedId.set(odontogramaId);
      await this.loadDetails(odontogramaId);
      await this.loadCpoManual(odontogramaId);
      await this.loadIndicadores(historiaId);
      await this.loadPiezasExaminadas(historiaId);
      await this.calculate();

      const details = [
        `${result.paciente.apellidos} ${result.paciente.nombres}`,
        result.edad !== null ? `Edad: ${result.edad} años` : null,
        result.paciente.telefono ? `Tel.: ${result.paciente.telefono}` : null,
        result.paciente.email ? `Email: ${result.paciente.email}` : null,
        result.paciente.direccion ? `Dir.: ${result.paciente.direccion}` : null,
        result.seguro ? `Seguro: ${result.seguro}` : null,
        result.historia ? `HC: ${result.historia.numero_formulario || 'registrada'}` : 'Historia clínica activa'
      ].filter(Boolean) as string[];
      this.pacienteInfo.set(details.join(' • '));
    } catch (error) {
      this.pacienteError.set(error instanceof Error ? error.message : 'No se pudo buscar el paciente.');
    } finally {
      this.buscandoPaciente.set(false);
    }
  }

  pacienteDisplayValue(): string {
    return this.pacienteInfo() ?? 'Sin paciente seleccionado';
  }

  pacienteNombre(pacienteId: string): string {
    return this.pacientesPorId().get(pacienteId) ?? 'Paciente sin identificar';
  }

  async remove(item: Odontograma): Promise<void> {
    if (!window.confirm('¿Está seguro de eliminar este odontograma?')) {
      return;
    }
    try { await this.odontogramaService.delete(item.id); this.toast.success('Odontograma eliminado'); this.clear(); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar odontograma'); }
  }

  async saveCpoManual(): Promise<void> {
    try {
      if (this.cpoForm.invalid) { this.cpoForm.markAllAsTouched(); return; }
      const { odontogramaId } = await this.ensureContext();
      const raw = this.cpoForm.getRawValue();
      const saved = await this.odontogramaService.guardarCpoManual(odontogramaId, {
        cariadas: Number(raw.cariadas) || 0,
        perdidas: Number(raw.perdidas) || 0,
        obturadas: Number(raw.obturadas) || 0,
        ceo: Number(raw.ceo) || 0,
        total: Number(raw.total) || 0,
        observaciones: emptyToNull(raw.observaciones)
      });
      this.cpoManual.set(saved);
      this.toast.success('Índices CPO guardados');
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar CPO manual'); }
  }

  async saveIndicadores(): Promise<void> {
    try {
      if (this.indicadoresForm.invalid) { this.indicadoresForm.markAllAsTouched(); return; }
      const { historiaId } = await this.ensureContext();
      const raw = this.indicadoresForm.getRawValue();
      const saved = await this.odontogramaService.guardarIndicadores(historiaId, {
        higiene_placa: Boolean(raw.higiene_placa),
        higiene_calculo: Boolean(raw.higiene_calculo),
        higiene_gingivitis: Boolean(raw.higiene_gingivitis),
        periodontal_leve: Boolean(raw.periodontal_leve),
        periodontal_moderada: Boolean(raw.periodontal_moderada),
        periodontal_severa: Boolean(raw.periodontal_severa),
        oclusion_clase_i: Boolean(raw.oclusion_clase_i),
        oclusion_clase_ii: Boolean(raw.oclusion_clase_ii),
        oclusion_clase_iii: Boolean(raw.oclusion_clase_iii),
        fluorosis_leve: Boolean(raw.fluorosis_leve),
        fluorosis_moderada: Boolean(raw.fluorosis_moderada),
        fluorosis_severa: Boolean(raw.fluorosis_severa),
        observaciones: emptyToNull(raw.observaciones)
      });
      this.indicadores.set(saved);
      this.toast.success('Indicadores guardados');
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar indicadores'); }
  }

  async togglePiezaExaminada(pieza: number): Promise<void> {
    try {
      const { historiaId } = await this.ensureContext();
      const next = this.piezasExaminadas().includes(pieza)
        ? this.piezasExaminadas().filter((item) => item !== pieza)
        : [...this.piezasExaminadas(), pieza];
      this.piezasExaminadas.set(next);
      await this.odontogramaService.guardarPiezasExaminadas(historiaId, next);
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar piezas examinadas'); }
  }

  async calculate(): Promise<void> {
    const pacienteId = this.form.controls.paciente_id.value;
    if (!pacienteId) { return; }
    try { this.cpo.set(await this.odontogramaService.calcularCpo(pacienteId)); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'RPC calcular_cpo no disponible'); }
  }

  selectTooth(pieza: number): void {
    this.selectedTooth.set(pieza);
    this.detailForm.patchValue({ pieza, superficie: this.currentDetail(pieza)?.superficie ?? '', movilidad: this.currentDetail(pieza)?.movilidad ?? 0, recesion: this.currentDetail(pieza)?.recesion ?? 0, notas: this.currentDetail(pieza)?.notas ?? '' });
  }

  surfaceColor(tooth: ToothViewModel, surface: ToothSurface): string {
    return getSurfaceColor(tooth.detail, surface);
  }

  async applyFinding(pieza: number, surface: ToothSurface, event: Event): Promise<void> {
    event.stopPropagation();
    this.selectTooth(pieza);
    try {
      const { odontogramaId } = await this.ensureContext();
      const current = this.currentDetail(pieza);
      const states = parseSurfaceFindings(current?.superficie);
      states[surface] = this.selectedFinding();
      const raw = this.detailForm.getRawValue();
      const conditionParts = new Set((current?.condicion ?? '').split('|').filter((item) => item && item !== 'sin_hallazgo'));
      conditionParts.add(this.selectedFinding());
      await this.odontogramaService.guardarDetalle({
        odontograma_id: odontogramaId, pieza, superficie: serializeSurfaceFindings(states),
        condicion: [...conditionParts].join('|'), movilidad: Number(raw.movilidad) || null,
        recesion: Number(raw.recesion) || null, notas: emptyToNull(raw.notas)
      });
      await this.loadDetails(odontogramaId);
      await this.calculate();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar hallazgo');
    }
  }

  private teethInOrder(numbers: number[]): ToothViewModel[] {
    const view = this.odontogramaView();
    return numbers.map((number) => view.find((tooth) => tooth.numero === number)!).filter(Boolean);
  }

  private currentDetail(pieza: number): OdontogramaDetalle | null {
    return this.detalles().find((item) => item.pieza === pieza) ?? null;
  }

  private async ensureContext(): Promise<{ historiaId: string; odontogramaId: string }> {
    const pacienteId = this.form.controls.paciente_id.value;
    if (!pacienteId) {
      throw new Error('Busca un paciente por cédula antes de continuar.');
    }

    let historiaId = this.form.controls.historia_id.value;
    if (!historiaId) {
      const historia = await this.historiaService.ensureActiveForPaciente(pacienteId);
      historiaId = historia.id;
      this.form.patchValue({ historia_id: historiaId });
    }

    const odontograma = await this.odontogramaService.ensureForHistoria(pacienteId, historiaId);
    this.selectedId.set(odontograma.id);
    this.form.patchValue({ historia_id: historiaId });
    return { historiaId, odontogramaId: odontograma.id };
  }

  private buildConditionValue(pieza: number): string {
    const current = this.currentDetail(pieza);
    const finding = this.selectedFinding();
    const currentCode = current?.condicion ?? 'sin_hallazgo';
    const normalized = currentCode.toLowerCase();
    if (finding === 'caries') {
      return normalized.includes('restauracion') ? 'caries|restauracion' : 'caries';
    }
    if (finding === 'restauracion') {
      return normalized.includes('caries') ? 'caries|restauracion' : 'restauracion';
    }
    if (finding === 'movilidad') {
      return normalized.includes('recesion') ? 'recesion|movilidad' : 'movilidad';
    }
    if (finding === 'recesion') {
      return normalized.includes('movilidad') ? 'movilidad|recesion' : 'recesion';
    }
    return 'sin_hallazgo';
  }

  private async loadCpoManual(odontogramaId: string): Promise<void> {
    try {
      const manual = await this.odontogramaService.cargarCpoManual(odontogramaId);
      this.cpoManual.set(manual);
      if (manual) {
        this.cpoForm.patchValue({ cariadas: manual.cariadas, perdidas: manual.perdidas, obturadas: manual.obturadas, ceo: manual.ceo, total: manual.total, observaciones: manual.observaciones ?? '' });
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo cargar CPO manual');
    }
  }

  private async loadIndicadores(historiaId: string): Promise<void> {
    if (!historiaId) {
      this.indicadores.set(null);
      this.indicadoresForm.reset({ higiene_placa: false, higiene_calculo: false, higiene_gingivitis: false, periodontal_leve: false, periodontal_moderada: false, periodontal_severa: false, oclusion_clase_i: false, oclusion_clase_ii: false, oclusion_clase_iii: false, fluorosis_leve: false, fluorosis_moderada: false, fluorosis_severa: false, observaciones: '' });
      return;
    }
    try {
      const indicadores = await this.odontogramaService.cargarIndicadores(historiaId);
      this.indicadores.set(indicadores);
      if (indicadores) {
        this.indicadoresForm.patchValue({
          higiene_placa: indicadores.higiene_placa,
          higiene_calculo: indicadores.higiene_calculo,
          higiene_gingivitis: indicadores.higiene_gingivitis,
          periodontal_leve: indicadores.periodontal_leve,
          periodontal_moderada: indicadores.periodontal_moderada,
          periodontal_severa: indicadores.periodontal_severa,
          oclusion_clase_i: indicadores.oclusion_clase_i,
          oclusion_clase_ii: indicadores.oclusion_clase_ii,
          oclusion_clase_iii: indicadores.oclusion_clase_iii,
          fluorosis_leve: indicadores.fluorosis_leve,
          fluorosis_moderada: indicadores.fluorosis_moderada,
          fluorosis_severa: indicadores.fluorosis_severa,
          observaciones: indicadores.observaciones ?? ''
        });
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo cargar indicadores');
    }
  }

  private async loadPiezasExaminadas(historiaId: string): Promise<void> {
    if (!historiaId) {
      this.piezasExaminadas.set([]);
      return;
    }
    try {
      const piezas = await this.odontogramaService.cargarPiezasExaminadas(historiaId);
      this.piezasExaminadas.set(piezas.map((item: PiezaExaminada) => item.pieza));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo cargar piezas examinadas');
    }
  }

  historiaStatusText(): string {
    return this.form.controls.historia_id.value ? 'Historia clínica activa y odontograma asociados automáticamente.' : 'Se abrirá o creará automáticamente al identificar el paciente.';
  }

  isPiezaExaminada(pieza: number): boolean {
    return this.piezasExaminadas().includes(pieza);
  }

  private getQuadrant(pieza: number): number {
    if ([18,17,16,15,14,13,12,11].includes(pieza)) { return 1; }
    if ([21,22,23,24,25,26,27,28].includes(pieza)) { return 2; }
    if ([31,32,33,34,35,36,37,38].includes(pieza)) { return 3; }
    if ([41,42,43,44,45,46,47,48].includes(pieza)) { return 4; }
    if ([55,54,53,52,51,61,62,63,64,65,85,84,83,82,81,71,72,73,74,75].includes(pieza)) { return 5; }
    return 5;
  }

  private normalizeMainForm(): void {
    const raw = this.form.getRawValue();
    this.form.patchValue({
      cedula: normalizeWhitespace(raw.cedula),
      observaciones: normalizeWhitespace(raw.observaciones)
    }, { emitEvent: false });
  }

  private normalizeDetailForm(): void {
    const raw = this.detailForm.getRawValue();
    this.detailForm.patchValue({
      superficie: normalizeWhitespace(raw.superficie),
      notas: normalizeWhitespace(raw.notas)
    }, { emitEvent: false });
  }
}
