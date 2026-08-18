import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ToastController,
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
} from '@ionic/angular/standalone';
import { RecoveryService } from '../services/recovery';
import { APP_TOAST } from 'src/constants/app.constants';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
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
export class ResetPasswordPage implements OnInit {
  private router = inject(Router);
  private toastController = inject(ToastController);
  private recoveryService = inject(RecoveryService);

  email = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  showPassword = false;
  loading = false;

  constructor() {
    // Capturar datos enviados desde la pantalla anterior
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.email = navigation.extras.state['email'];
      this.code = navigation.extras.state['code'];
    }
  }

  ngOnInit() {
    // Si no hay email o código, regresamos por seguridad
    if (!this.email || !this.code) {
      this.router.navigate(['/auth/account_recovery'], { replaceUrl: true });
    }
  }

  async onResetPassword() {
    if (this.newPassword.length < 6) {
      this.showToast(
        'La contraseña debe tener al menos 6 caracteres',
        'warning',
      );
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showToast('Las contraseñas no coinciden', 'danger');
      return;
    }

    this.loading = true;

    this.recoveryService
      .resetPassword(this.email, this.code, this.newPassword)
      .subscribe({
        next: (_res) => {
          this.loading = false;
          this.showToast('Contraseña actualizada con éxito', 'success');
          this.router.navigate(['/auth/login'], { replaceUrl: true });
        },
        error: (err) => {
          this.loading = false;
          this.showToast(
            err.error?.message || 'Error al restablecer la contraseña',
            'danger',
          );
        },
      });
  }

  async showToast(msg: string, color: any) {
    const toast = await this.toastController.create({
      message: msg,
      duration: APP_TOAST.DURATION,
      position: APP_TOAST.POSITION,
      color: color,
    });
    await toast.present();
  }

  goBack() {
    this.router.navigate(['/auth/account_recovery']);
  }
}
