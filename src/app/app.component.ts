import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Section = 'resumen' | 'paciente' | 'anamnesis' | 'examen' | 'odontograma' | 'diagnostico' | 'tratamiento';
type Mark = 'caries' | 'obturado' | 'extraccion' | 'ausente' | 'sellante' | 'endodoncia';

interface Tooth { number: number; mark?: Mark; mobility?: number; recession?: number; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  section: Section = 'resumen';
  menuOpen = false;
  saved = false;
  toast = '';
  selectedMark: Mark = 'caries';
  selectedTooth?: Tooth;
  patient = { firstName: 'Valentina', lastName: 'Mendoza', id: '1719234567', history: 'HCU-2026-00482', age: 29, sex: 'Femenino', pregnant: 'No', phone: '099 482 7712' };
  personalHistory = ['Alergia a antibiótico', 'Alergia a anestesia', 'Hemorragias', 'VIH / SIDA', 'Tuberculosis', 'Asma', 'Diabetes', 'Hipertensión arterial', 'Enfermedad cardíaca'];
  stomatognathic = ['Labios', 'Mejillas', 'Maxilar superior', 'Maxilar inferior', 'Lengua', 'Paladar', 'Piso de la boca', 'Carrillos', 'Glándulas salivales', 'Orofaringe', 'A.T.M.', 'Ganglios'];
  checkedHistory = new Set<string>(['Alergia a antibiótico']);
  checkedExam = new Set<string>(['A.T.M.']);
  permanent = this.makeTeeth([18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]);
  temporary = this.makeTeeth([55,54,53,52,51,61,62,63,64,65,85,84,83,82,81,71,72,73,74,75]);
  marks: { id: Mark; label: string; color: string }[] = [
    { id: 'caries', label: 'Caries', color: '#e45858' }, { id: 'obturado', label: 'Obturado', color: '#4285c5' },
    { id: 'extraccion', label: 'Extracción indicada', color: '#e45858' }, { id: 'ausente', label: 'Ausente', color: '#667085' },
    { id: 'sellante', label: 'Sellante', color: '#8b5cf6' }, { id: 'endodoncia', label: 'Endodoncia', color: '#ef8b36' }
  ];

  private makeTeeth(numbers: number[]): Tooth[] {
    return numbers.map((number) => number === 16 ? { number, mark: 'caries' } : number === 26 ? { number, mark: 'obturado' } : { number });
  }
  nav(section: Section): void { this.section = section; this.menuOpen = false; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  toggle(set: Set<string>, value: string): void { set.has(value) ? set.delete(value) : set.add(value); }
  markTooth(tooth: Tooth): void { tooth.mark = tooth.mark === this.selectedMark ? undefined : this.selectedMark; this.selectedTooth = tooth; }
  save(): void { localStorage.setItem('odontocare-draft', JSON.stringify({ patient: this.patient, permanent: this.permanent, temporary: this.temporary })); this.saved = true; this.showToast('Borrador guardado en este dispositivo'); }
  newHistory(): void { this.nav('paciente'); this.showToast('Nueva historia clínica iniciada'); }
  showToast(message: string): void { this.toast = message; setTimeout(() => this.toast = '', 2600); }
}
