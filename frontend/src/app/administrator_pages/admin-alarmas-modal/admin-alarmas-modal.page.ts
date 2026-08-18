import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  ModalController,
  IonButtons,
} from '@ionic/angular/standalone';

import { NodeSelectorComponent } from 'src/app/shared/node-selector/node-selector.component';

@Component({
  selector: 'app-admin-alarmas-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonButtons,
    IonToolbar,
    IonButton,
    NodeSelectorComponent,
  ],
  templateUrl: './admin-alarmas-modal.page.html',
})
export class AdminAlarmasModalPage implements OnInit {
  private modalCtrl = inject(ModalController);

  // Recibimos los IDs actuales desde el componente padre
  @Input() selectedIds: number[] = [];

  // Variable local para manejar la selección mientras el modal esté abierto
  idsActuales: number[] = [];

  ngOnInit() {
    // Clonamos el array para trabajar sobre una copia independiente
    this.idsActuales = this.selectedIds ? [...this.selectedIds] : [];
  }

  onSelectionChange(ids: number[]) {
    this.idsActuales = [...ids];
  }

  cerrar() {
    this.modalCtrl.dismiss();
  }

  guardar() {
    this.modalCtrl.dismiss({
      ids: [...this.idsActuales],
    });
  }
}
