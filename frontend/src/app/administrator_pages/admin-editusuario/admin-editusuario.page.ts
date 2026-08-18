import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonList,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  ModalController,
  IonIcon,
} from '@ionic/angular/standalone';
import { MODAL_ROLES } from 'src/constants/app.constants';
import { Usuario } from 'src/app/interfaces/usuario.interface';
import { AdminConfirusuarioPage } from '../admin-confirusuario/admin-confirusuario.page';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';

@Component({
  selector: 'app-admin-editusuario',
  templateUrl: './admin-editusuario.page.html',
  styleUrls: ['./admin-editusuario.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonList,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    AdminBackHeaderComponent,
  ],
})
export class AdminEditusuarioPage implements OnInit {
  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);

  @Input() usuario!: Usuario;

  form!: FormGroup;

  ngOnInit() {
    this.form = this.fb.group({
      full_name: ['', Validators.required],

      // 🔒 BLOQUEO DE EMAIL: Se define como deshabilitado desde el inicio
      email: [
        { value: '', disabled: true },
        [Validators.required, Validators.email],
      ],

      phone: ['', [Validators.pattern('^[0-9]{0,10}$')]],
      address: [''],
      reference: [''],
      age: [null, [Validators.min(0), Validators.max(100)]],
    });

    if (this.usuario) {
      this.form.patchValue({
        full_name: this.usuario.full_name,
        email: this.usuario.email, // Se cargará pero estará bloqueado
        phone: this.usuario.phone || '',
        address: this.usuario.address || '',
        reference: this.usuario.reference || '',
        age: this.usuario.age,
      });
    }
  }

  // Dentro de tu componente de Edición
  async guardar() {
    const modal = await this.modalCtrl.create({
      component: AdminConfirusuarioPage,
      componentProps: {
        usuarioOriginal: this.usuario,
        // 🔥 getRawValue() incluye campos deshabilitados (como el email)
        usuarioEditado: this.form.getRawValue(),
      },
    });

    await modal.present();
    const { data, role } = await modal.onDidDismiss();

    if (role === MODAL_ROLES.CONFIRMADO && data?.confirmado) {
      this.modalCtrl.dismiss({
        cambiosPendientes: true,
        nuevosDatos: data.usuarioEditado,
      });
    }
  }
  cancelar() {
    this.modalCtrl.dismiss(null, MODAL_ROLES.CANCELAR);
  }
}
