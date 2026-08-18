import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonAvatar,
} from '@ionic/angular/standalone';
import { ToastController, NavController } from '@ionic/angular'; // Importar ToastController
import { CuentaUsuariF, UsuarioFinal } from '../services/cuenta-usuari-f';
import { user_data } from 'src/app/interfaces/user_data.interface';
@Component({
  selector: 'app-datos-usuario-f',
  templateUrl: './datos-usuario-f.page.html',
  styleUrls: ['./datos-usuario-f.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonAvatar,
    CommonModule,
    FormsModule,
  ],
})
export class DatosUsuarioFPage implements OnInit {
  // 🔥 INYECCIÓN MODERNA (SOLUCIÓN AL LINT)
  private cuentaService = inject(CuentaUsuariF);
  private navCtrl = inject(NavController);
  private toastCtrl = inject(ToastController); // Inyectar el controlador de alertas

  usuario!: UsuarioFinal;

  // copia para comparar cambios
  usuarioOriginal!: UsuarioFinal;
  formulario: user_data = {
    foto: undefined,
    telefono: undefined,
    passwordActual: undefined,
    nuevaPassword: undefined,
  };

  ngOnInit() {
    this.usuarioOriginal = { ...this.usuario };

    this.formulario = {
      foto: this.usuario.foto,
      telefono: this.usuario.telefono,
      passwordActual: '',
      nuevaPassword: '',
    };
  }

  // Función genérica para mostrar alertas
  async mostrarMensaje(mensaje: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000, // Se quita solo en 2 segundos
      color: color, // 'success' para verde, 'danger' para rojo
      position: 'bottom',
      // No incluimos 'buttons' para que no salga la opción de aceptar
    });
    await toast.present();
  }

  hayCambios(): boolean {
    // 1. Validación de Teléfono (Siempre 10 dígitos)
    const soloNumeros = /^\d+$/;
    const telefono = this.formulario.telefono ?? '';

    const telefonoValido = telefono.length === 10 && soloNumeros.test(telefono);

    // 2. Validación de Contraseña
    const escribiendoNueva =
      (this.formulario.nuevaPassword?.trim().length ?? 0) > 0;
    const escribiendoActual =
      (this.formulario.passwordActual?.trim().length ?? 0) > 0;

    // Si escribe en CUALQUIERA de los dos campos de pass, ambos se vuelven obligatorios
    let seccionPassValida = true;
    if (escribiendoNueva || escribiendoActual) {
      seccionPassValida =
        escribiendoActual &&
        (this.formulario.nuevaPassword?.trim().length ?? 0) >= 6;
    }

    // 3. ¿Hubo cambios reales?
    const huboCambioFoto = this.formulario.foto !== this.usuarioOriginal.foto;
    const huboCambioTelf =
      this.formulario.telefono !== this.usuarioOriginal.telefono;
    const huboCambioPass = escribiendoNueva;

    // El botón se activa si:
    // - El teléfono es válido (10 dígitos)
    // - La sección de password es coherente (si se tocó, que esté completa)
    // - Al menos una cosa cambió
    return (
      telefonoValido &&
      seccionPassValida &&
      (huboCambioFoto || huboCambioTelf || huboCambioPass)
    );
  }

  async guardarCambios() {
    if (!this.hayCambios()) return;

    // 1. Validar Contraseña si se intentó cambiar

    // 2. Guardar Teléfono y Foto
    if (this.formulario.telefono !== this.usuarioOriginal.telefono) {
      // Aqui iria conexiones reales al backend
    }

    if (this.formulario.foto !== this.usuarioOriginal.foto) {
      // Aqui iria conexiones reales al backend
    }

    // 3. TOAST VERDE DE ÉXITO
    await this.mostrarMensaje('Datos actualizados correctamente', 'success');

    // Resetear y volver
    this.usuarioOriginal = { ...this.usuario };
    // Actualizar el usuario en memoria con los datos guardados
    this.usuario.telefono = this.formulario.telefono ?? '';
    this.usuario.foto = this.formulario.foto ?? '';
    this.formulario.passwordActual = '';
    this.formulario.nuevaPassword = '';

    // Esperamos un poco para que alcancen a ver el toast verde antes de salir
    setTimeout(() => {
      this.navCtrl.navigateBack(['/final-user/principal-usuariof']);
    }, 1500);
  }

  salir() {
    this.navCtrl.navigateBack(['/final-user/principal-usuariof']);
  }
}
