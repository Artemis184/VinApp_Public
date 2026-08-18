import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { RecoveryService } from '../services/recovery';
import { CuentaUsuariF } from '../../final_user_pages/services/cuenta-usuari-f';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
} from '@ionic/angular/standalone';
@Component({
  selector: 'app-account-recovery',
  templateUrl: './account-recovery.page.html',
  styleUrls: ['./account-recovery.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    IonInput,
    CommonModule,
    FormsModule,
  ],
})
export class AccountRecoveryPage implements OnDestroy {
  email = '';
  inputCode = '';
  step = 1;
  loading = false;

  private router = inject(Router);
  private toastController = inject(ToastController);
  public recoveryService = inject(RecoveryService);
  private cuentaService = inject(CuentaUsuariF);

  // Paso 1: Enviar el código al API
  async sendCode() {
    if (!this.email || !this.email.includes('@')) {
      this.showToast('Por favor, ingresa un correo válido.', 'danger');
      return;
    }

    const currentCooldown = this.recoveryService.getCooldown();
    if (currentCooldown > 0) {
      this.showToast(`Espera ${currentCooldown}s para reenviar.`, 'warning');
      return;
    }

    this.loading = true;

    this.recoveryService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.loading = false;
        this.step = 2;
        this.showToast(res.message, 'success');
      },
      error: (err) => {
        this.loading = false;
        this.showToast(
          err.error?.message || 'Error al enviar el código.',
          'danger',
        );
      },
    });
  }

  // Paso 2: Verificar el código con el API
  async verifyCode() {
    const codeToVerify = this.inputCode ? this.inputCode.toString().trim() : '';
    const codeRegex = /^\d{6}$/;

    if (!codeRegex.test(codeToVerify)) {
      this.showToast(
        'El código debe contener exactamente 6 dígitos.',
        'warning',
      );
      return;
    }

    this.loading = true;

    this.recoveryService.verifyResetCode(this.email, codeToVerify).subscribe({
      next: (_res) => {
        this.loading = false;
        this.showToast('Código verificado con éxito.', 'success');

        // Navegamos pasando el email y el código al siguiente componente
        this.router.navigate(['/auth/reset_password'], {
          state: {
            email: this.email,
            code: codeToVerify,
          },
        });
      },
      error: (err) => {
        this.loading = false;
        this.showToast(
          err.error?.message || 'Código incorrecto o expirado.',
          'danger',
        );
        this.inputCode = '';
      },
    });
  }

  // Helper mejorado para mostrar colores según el estado
  async showToast(
    msg: string,
    color: 'success' | 'warning' | 'danger' = 'warning',
  ) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 2500,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }

  goBack() {
    if (this.step === 2) {
      this.step = 1;
      this.inputCode = '';
    } else {
      this.resetFields();
      this.router.navigate(['/auth/login'], { replaceUrl: true });
    }
  }

  private resetFields() {
    this.step = 1;
    this.email = '';
    this.inputCode = '';
  }

  ngOnDestroy() {
    // Nota: Si quieres que el cooldown siga aunque salga de la página,
    // comenta la línea de abajo. Si quieres que se limpie, déjala.
    this.recoveryService.stopGlobalCooldown();
  }
  validateOnlyNumbers(event: any) {
    const value = event.target.value;
    // Reemplaza cualquier cosa que NO sea un número (0-9) con un string vacío
    this.inputCode = value.replace(/[^0-9]/g, '');

    // Sincroniza el valor del elemento visual por si acaso
    event.target.value = this.inputCode;
  }
}
