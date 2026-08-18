import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonSpinner,
  IonText,
} from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Alarmas, Alarma } from 'src/app/administrator_pages/services/alarmas';
import { BackendResponse } from 'src/app/administrator_pages/services/user-nodes';

@Component({
  selector: 'app-node-selector',
  standalone: true,
  templateUrl: './node-selector.component.html',
  styleUrls: ['./node-selector.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,
    IonSpinner,
    IonText,
  ],
})
export class NodeSelectorComponent implements OnInit, OnDestroy {
  private alarmasService = inject(Alarmas);
  private destroy$ = new Subject<void>();

  // INPUT: IDs que ya tiene el usuario.
  @Input() selectedIds: number[] = [];

  // OUTPUT: Avisa cuando marcas/desmarcas
  @Output() selectionChange = new EventEmitter<number[]>();

  nodos: Alarma[] = []; // Usamos la interfaz Alarma
  loading = true;
  errorMessage = '';

  ngOnInit() {
    this.cargarAlarmasReales();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarAlarmasReales() {
    this.loading = true;
    this.alarmasService
      .getAlarmas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: BackendResponse<Alarma[]>) => {
          if (response && response.data) {
            this.nodos = response.data;
          } else {
            this.nodos = [];
          }

          this.loading = false;
        },
        error: (err: any) => {
          console.error('Error cargando alarmas', err);
          this.errorMessage =
            'Error al cargar alarmas. Por favor recarga la página.';
          this.loading = false;
          this.nodos = [];
        },
      });
  }

  isChecked(id: number): boolean {
    // Verificamos si el ID está en el array de seleccionados
    return Array.isArray(this.selectedIds) && this.selectedIds.includes(id);
  }

  toggleSelection(id: number) {
    // 1. Creamos la nueva lista basada en el estado actual
    let newIds = [...(this.selectedIds || [])];

    if (newIds.includes(id)) {
      newIds = newIds.filter((x) => x !== id);
    } else {
      newIds.push(id);
    }

    // 2. ACTUALIZACIÓN INTERNA (CRÍTICO):
    // Si no actualizamos esto aquí, el siguiente clic o el guardado del modal
    // leerán el valor viejo y parecerá que no se seleccionó nada.
    this.selectedIds = [...newIds];

    // 3. Emitimos al Modal
    this.selectionChange.emit(this.selectedIds);
  }
}
