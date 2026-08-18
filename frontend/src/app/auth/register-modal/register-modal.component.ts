import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  IonItem,
  ToastController,
  IonSpinner,
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import {
  RegisterService,
  CompleteRegisterPayload,
} from '../services/register.service';

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [
    IonSpinner,
    CommonModule,
    FormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonIcon,
    IonItem,
  ],
  templateUrl: './register-modal.component.html',
  styleUrls: ['./register-modal.component.scss'],
})
export class RegisterModalComponent implements OnInit {
  @Input() initialStep = 1;
  @Input() createdUserId: string | null = null;
  @Input() initialFullName = '';

  step = 1;

  // ===== PASO 1 =====
  email = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirmPassword = false;
  passwordStrength = 0;

  // ===== PASO 2 =====
  nombres = '';
  telefono = '';
  direccion = '';
  referencia = '';

  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private registerService = inject(RegisterService);

  isSubmittingStep1 = false;
  isSubmittingStep2 = false;

  ngOnInit(): void {
    if (this.initialStep === 2 && this.createdUserId) {
      this.step = 2;
      this.nombres = this.initialFullName?.trim() ?? '';
    }
  }

  /* ========================= */
  /* FUERZA DE CONTRASEÑA */
  /* ========================= */
  evaluatePassword() {
    let strength = 0;

    if (this.password.length >= 8) strength++;
    if (/[A-Z]/.test(this.password)) strength++;
    if (/[0-9]/.test(this.password)) strength++;
    if (/[^A-Za-z0-9]/.test(this.password)) strength++;

    this.passwordStrength = strength;
  }

  /* ========================= */
  /* MOSTRAR CONTRASEÑA 2s */
  /* ========================= */
  showPasswordTemporarily() {
    this.showPassword = true;
    setTimeout(() => {
      this.showPassword = false;
    }, 2000);
  }

  showConfirmPasswordTemporarily() {
    this.showConfirmPassword = true;
    setTimeout(() => {
      this.showConfirmPassword = false;
    }, 2000);
  }

  /* ========================= */
  /* VERIFICAR COINCIDENCIA */
  /* ========================= */
  passwordsMatch(): boolean {
    return (
      this.password === this.confirmPassword && this.confirmPassword.length > 0
    );
  }

  passwordsDontMatch(): boolean {
    return (
      this.password !== this.confirmPassword && this.confirmPassword.length > 0
    );
  }

  /* ========================= */
  /* REQUISITOS DE CONTRASEÑA */
  /* ========================= */
  hasMinLength(): boolean {
    return this.password.length >= 8;
  }

  hasUpperCase(): boolean {
    return /[A-Z]/.test(this.password);
  }

  hasNumber(): boolean {
    return /[0-9]/.test(this.password);
  }

  hasSpecialChar(): boolean {
    return /[^A-Za-z0-9]/.test(this.password);
  }

  /* ========================= */
  /* PASO 1 VALIDACIÓN */
  /* ========================= */
  async nextStepFromCredentials() {
    if (this.isSubmittingStep1) return; // evitar doble click

    if (!this.email || !this.password || !this.confirmPassword) {
      return this.toast('Complete todos los campos', 'warning');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      return this.toast('Correo electrónico inválido', 'warning');
    }

    if (this.passwordStrength < 3) {
      return this.toast('La contraseña es débil', 'warning');
    }

    if (this.password !== this.confirmPassword) {
      return this.toast('Las contraseñas no coinciden', 'danger');
    }

    this.isSubmittingStep1 = true; // bloquear botón

    this.registerService
      .createUserWithEmail({
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (resp) => {
          this.createdUserId = resp.data.id;
          this.step = 2;
          this.isSubmittingStep1 = false; // desbloquear
        },
        error: (err) => {
          this.isSubmittingStep1 = false; // desbloquear
          this.toast(err?.error?.message || 'Error al crear usuario', 'danger');
        },
      });
  }

  /* ========================= */
  /* PASO 2 VALIDACIÓN */
  /* ========================= */
  async submitPersonalData() {
    if (this.isSubmittingStep2) return;

    if (!this.createdUserId) {
      return this.toast('Error interno. Intente nuevamente.', 'danger');
    }

    if (!this.nombres || !this.telefono || !this.direccion) {
      return this.toast('Complete todos los campos obligatorios', 'warning');
    }

    if (this.nombres.trim().length < 3) {
      return this.toast('Ingrese nombres válidos', 'warning');
    }

    const phoneRegex = /^09\d{8}$/;
    if (!phoneRegex.test(this.telefono)) {
      return this.toast('Número celular inválido. Ej: 0991234567', 'warning');
    }

    if (this.direccion.trim().length < 5) {
      return this.toast('La dirección es muy corta', 'warning');
    }

    if (this.referencia && this.referencia.trim().length < 5) {
      return this.toast('La referencia domiciliaria es muy corta', 'warning');
    }

    const payload: CompleteRegisterPayload = {
      full_name: this.nombres.trim(),
      phone: this.telefono.trim(),
      address: this.direccion.trim(),
      ...(this.referencia?.trim() ? { reference: this.referencia.trim() } : {}),
    };

    this.isSubmittingStep2 = true;

    this.registerService
      .completeRegister(this.createdUserId, payload)
      .subscribe({
        next: () => {
          this.step = 3;
          this.isSubmittingStep2 = false;
        },
        error: (err) => {
          this.isSubmittingStep2 = false;
          this.toast(
            err?.error?.message || 'Error al completar registro',
            'danger',
          );
        },
      });
  }

  close() {
    this.modalCtrl.dismiss();
  }

  async toast(message: string, color: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
    });
    await t.present();
  }
}
