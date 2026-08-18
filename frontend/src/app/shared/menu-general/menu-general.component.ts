import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonAvatar,
  IonIcon,
} from '@ionic/angular/standalone';
import { ToastController, AlertController } from '@ionic/angular';
import { ModalController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import {
  ApiErrorResponse,
  DatosUsuarioForm,
  MenuGeneralUserInput,
  MyProfileResponse,
} from './interfaces/datos_usuario.interface';
import { MENU_GENERAL_CONFIG } from 'src/constants/app.constants';
import { MenuGeneralProfileService } from './services/menu-general-profile.service';
import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-menu-general',
  standalone: true,
  templateUrl: './menu-general.component.html',
  styleUrls: ['./menu-general.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonAvatar,
    IonIcon,
  ],
})
export class MenuGeneralComponent implements OnInit, OnDestroy {
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private profileService = inject(MenuGeneralProfileService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private avatarObjectUrl: string | null = null;
  private readonly loginRoute = '/auth/login';

  @Input() usuario: MenuGeneralUserInput | null = null;
  @Input() esGoogle = false;

  formulario: DatosUsuarioForm = {};
  usuarioOriginal: DatosUsuarioForm = {};
  avatarPreview: string = MENU_GENERAL_CONFIG.DEFAULT_AVATAR_PATH;
  readonly avatarAccept: string = MENU_GENERAL_CONFIG.AVATAR_ACCEPT;
  readonly phoneMaxLength: number = MENU_GENERAL_CONFIG.PHONE_MAX_LENGTH;
  cargando = false;

  ngOnInit() {
    this.cargarPerfil();
  }

  ngOnDestroy() {
    this.liberarAvatarObjectUrl();
  }

  private async cargarPerfil() {
    this.cargando = true;

    try {
      const response = await firstValueFrom(this.profileService.getMyProfile());

      const data = response?.data;

      if (!data) {
        throw new Error('Perfil sin datos');
      }

      this.inicializarFormulario(data);

      this.cargarAvatar(data);
    } catch {
      this.avatarPreview =
        this.usuario?.foto || MENU_GENERAL_CONFIG.DEFAULT_AVATAR_PATH;
      await this.mostrarToast('No se pudo cargar el perfil', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  private inicializarFormulario(data: MyProfileResponse['data']) {
    this.formulario = {
      full_name: data.full_name || '',
      apodo: data.apodo || '',
      phone: data.phone || '',
      address: data.address || '',
      reference: data.reference || '',
      passwordActual: '',
      password: '',
      avatar: null,
    };

    this.usuarioOriginal = {
      full_name: this.formulario.full_name,
      apodo: this.formulario.apodo,
      phone: this.formulario.phone,
      address: this.formulario.address,
      reference: this.formulario.reference,
    };
  }

  private cargarAvatar(data: MyProfileResponse['data']) {
    this.liberarAvatarObjectUrl();

    if (data?.avatar_base64 && data?.avatar_mime_type) {
      this.avatarPreview = `data:${data.avatar_mime_type};base64,${data.avatar_base64}`;
      return;
    }

    const profilePhoto = data?.profile_photo?.trim();

    if (
      profilePhoto?.startsWith('http://') ||
      profilePhoto?.startsWith('https://')
    ) {
      this.avatarPreview = profilePhoto.replace(/^http:\/\//i, 'https://');
      return;
    }

    this.avatarPreview =
      this.usuario?.foto || MENU_GENERAL_CONFIG.DEFAULT_AVATAR_PATH;
  }

  onAvatarLoadError() {
    this.avatarPreview =
      this.usuario?.foto || MENU_GENERAL_CONFIG.DEFAULT_AVATAR_PATH;
  }

  private liberarAvatarObjectUrl() {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
      this.avatarObjectUrl = null;
    }
  }

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const esTipoPermitido =
      MENU_GENERAL_CONFIG.AVATAR_ALLOWED_MIME_TYPES.includes(
        file.type as (typeof MENU_GENERAL_CONFIG.AVATAR_ALLOWED_MIME_TYPES)[number],
      );

    if (!esTipoPermitido) {
      this.mostrarToast('Formato inválido. Usa JPG, PNG o WEBP', 'danger');
      input.value = '';
      return;
    }

    if (file.size > MENU_GENERAL_CONFIG.AVATAR_MAX_SIZE_BYTES) {
      this.mostrarToast('La imagen supera el límite de 5MB', 'danger');
      input.value = '';
      return;
    }

    this.formulario.avatar = file;
    this.liberarAvatarObjectUrl();
    this.avatarObjectUrl = URL.createObjectURL(file);
    this.avatarPreview = this.avatarObjectUrl;
  }

  async abrirModalPassword() {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar contraseña',
      inputs: [
        {
          name: 'passwordActual',
          type: 'password',
          placeholder: 'Contraseña actual',
          attributes: {
            autocomplete: 'current-password',
          },
        },
        {
          name: 'password',
          type: 'password',
          placeholder: 'Nueva contraseña',
          attributes: {
            autocomplete: 'new-password',
          },
        },
        {
          name: 'passwordConfirmacion',
          type: 'password',
          placeholder: 'Repetir nueva contraseña',
          attributes: {
            autocomplete: 'new-password',
          },
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar',
          handler: async (values) => {
            const actual = (values.passwordActual || '').trim();
            const nueva = (values.password || '').trim();
            const confirmacion = (values.passwordConfirmacion || '').trim();

            if (!actual || !nueva || !confirmacion) {
              await this.mostrarToast(
                'Debes completar todos los campos de contraseña',
                'danger',
              );
              return false;
            }

            if (nueva !== confirmacion) {
              await this.mostrarToast(
                'La nueva contraseña no coincide con la confirmación',
                'danger',
              );
              return false;
            }

            if (nueva.length < MENU_GENERAL_CONFIG.PASSWORD_MIN_LENGTH) {
              await this.mostrarToast(
                'La nueva contraseña debe tener al menos 6 caracteres',
                'danger',
              );
              return false;
            }

            if (this.cargando) {
              return false;
            }

            this.cargando = true;

            try {
              const formData = new FormData();
              formData.append('passwordActual', actual);
              formData.append('password', nueva);

              await firstValueFrom(
                this.profileService.updateMyProfile(formData),
              );

              this.formulario.passwordActual = '';
              this.formulario.password = '';

              await this.redirigirAlLoginPorCambioPassword();
              return true;
            } catch (error: unknown) {
              const apiError = error as ApiErrorResponse;
              const message =
                apiError?.error?.message ||
                'No se pudo actualizar la contraseña';
              await this.mostrarToast(message, 'danger');
              return false;
            } finally {
              this.cargando = false;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private hayCambios(): boolean {
    const cambioApodo = this.formulario.apodo !== this.usuarioOriginal.apodo;
    const cambioTelefono = this.formulario.phone !== this.usuarioOriginal.phone;
    const cambioAvatar = !!this.formulario.avatar;
    const cambioPassword =
      !!this.formulario.passwordActual?.trim() &&
      !!this.formulario.password?.trim();

    return cambioApodo || cambioTelefono || cambioAvatar || cambioPassword;
  }

  async guardarCambios() {
    if (!this.hayCambios()) {
      await this.mostrarToast('No hay cambios para guardar', 'warning');
      return;
    }

    const formData = this.construirPayloadActualizacion();

    this.cargando = true;

    try {
      await firstValueFrom(this.profileService.updateMyProfile(formData));
      const successToast = await this.toastCtrl.create({
        message: 'Perfil actualizado correctamente',
        duration: MENU_GENERAL_CONFIG.TOAST_DURATION_MS,
        color: 'success',
        position: 'bottom',
      });
      await successToast.present();

      this.limpiarCamposSensibles();
      this.cerrarDirecto();
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      const message =
        apiError?.error?.message || 'No se pudo actualizar el perfil';
      await this.mostrarToast(message, 'danger');
    } finally {
      this.cargando = false;
    }
  }

  private construirPayloadActualizacion(): FormData {
    const formData = new FormData();

    if (this.formulario.apodo !== this.usuarioOriginal.apodo) {
      formData.append('apodo', this.formulario.apodo || '');
    }

    if (this.formulario.phone !== this.usuarioOriginal.phone) {
      formData.append('phone', this.formulario.phone || '');
    }

    if (this.formulario.avatar) {
      formData.append('avatar', this.formulario.avatar);
    }

    if (this.formulario.passwordActual && this.formulario.password) {
      formData.append('passwordActual', this.formulario.passwordActual);
      formData.append('password', this.formulario.password);
    }

    return formData;
  }

  private limpiarCamposSensibles() {
    this.formulario.passwordActual = '';
    this.formulario.password = '';
    this.formulario.avatar = null;
  }

  private async redirigirAlLoginPorCambioPassword(): Promise<void> {
    this.authService.logout().subscribe({
      error: () => {
        // Sin bloqueo: la navegación ya se ejecutó.
      },
    });

    this.cerrarDirecto();
    await this.router.navigateByUrl(this.loginRoute, { replaceUrl: true });
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: MENU_GENERAL_CONFIG.TOAST_DURATION_MS,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  private cerrarDirecto() {
    this.modalCtrl.dismiss();
  }

  async cerrar() {
    if (this.cargando) return;

    if (!this.hayCambios()) {
      this.cerrarDirecto();
      return;
    }

    const confirmacion = await this.alertCtrl.create({
      header: '¿Deseas guardar los cambios?',
      message: 'Tienes cambios sin guardar en tu perfil.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Salir sin guardar',
          role: 'destructive',
          handler: () => {
            this.cerrarDirecto();
          },
        },
        {
          text: 'Guardar y salir',
          handler: async () => {
            await this.guardarCambios();
            return true;
          },
        },
      ],
    });

    await confirmacion.present();
  }
}
