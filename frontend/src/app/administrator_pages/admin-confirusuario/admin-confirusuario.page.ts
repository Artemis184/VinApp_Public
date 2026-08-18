import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonButton,
  ModalController,
  IonBadge,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Usuario } from 'src/app/interfaces/usuario.interface';
import {
  getEstadoTraducido,
  getEstadoUsuarioColor,
  MODAL_ROLES, // 🛡️ Importamos las constantes
} from 'src/constants/app.constants';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  closeCircle,
  checkboxOutline,
  informationCircleOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-admin-confirusuario',
  templateUrl: './admin-confirusuario.page.html',
  styleUrls: ['./admin-confirusuario.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardContent,
    IonButton,
    IonBadge,
    IonIcon,
    IonSpinner,
  ],
})
export class AdminConfirusuarioPage {
  private modalCtrl = inject(ModalController);

  @Input() usuarioOriginal!: Usuario;
  @Input() usuarioEditado!: Usuario;

  getEstadoUsuarioColor = getEstadoUsuarioColor;
  getEstadoTraducido = getEstadoTraducido;

  campos: (keyof Usuario)[] = [
    'full_name',
    'email',
    'phone',
    'address',
    'reference',
    'age',
  ];

  constructor() {
    addIcons({
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'checkbox-outline': checkboxOutline,
      'information-circle-outline': informationCircleOutline,
    });
  }

  enviandoDatos = false;

  cancelar() {
    this.modalCtrl.dismiss({ confirmado: false }, MODAL_ROLES.CANCELAR);
  }

  async confirmar() {
    if (!this.huboCambios()) return;

    await this.modalCtrl.dismiss(
      { confirmado: true, usuarioEditado: this.usuarioEditado },
      MODAL_ROLES.CONFIRMADO,
    );
  }

  huboCambios(): boolean {
    return this.campos.some((campo) => this.cambio(campo));
  }

  cambio(campo: keyof Usuario): boolean {
    const original = this.usuarioOriginal[campo] ?? '';
    const editado = this.usuarioEditado[campo] ?? '';
    return original !== editado;
  }
}
