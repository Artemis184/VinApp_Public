import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, inject, AfterViewInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { ModalController } from '@ionic/angular/standalone';
import { RegisterModalComponent } from '../register-modal/register-modal.component';
import {
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';

import { AuthService } from 'src/app/auth/services/auth.service';
import {
  APP_ROLES,
  APP_TOAST,
  AUTH_STORAGE,
} from '../../../constants/app.constants';
import { environment } from 'src/environments/environment';
import { NavigationService } from 'src/app/services/navigation.service';

declare let google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonIcon,
  ],
})
export class LoginPage implements AfterViewInit {
  email = '';
  password = '';
  loading = false;
  showPassword = false;
  isNativeApp = Capacitor.isNativePlatform();
  googleButtonReady = false;
  googleButtonError = false;
  private googleInitInProgress = false;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastController = inject(ToastController);
  private modalCtrl = inject(ModalController);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private navigationService = inject(NavigationService);

  /** Redirige según el rol del usuario */
  redirectByRole(rol: string) {
    let ruta = '/final-user/principal-usuariof';
    if (rol === APP_ROLES.ADMIN) {
      ruta = '/administrator/principal-administrador';
    } else if (rol === APP_ROLES.FINAL_USER) {
      ruta = '/final-user/principal-usuariof';
    }
    this.router.navigate([ruta]);
  }

  /* ======================
     LOGIN NORMAL
  ====================== */
  async login() {
    const emailTrimmed = this.email.trim();
    const passwordTrimmed = this.password;

    if (!emailTrimmed || !passwordTrimmed) {
      this.presentToast('Por favor, llena todos los campos', 'warning');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      this.presentToast('Ingresa un correo válido', 'warning');
      return;
    }

    this.loading = true;
    await new Promise((r) => setTimeout(r, 700)); // UX delay

    this.authService
      .login(emailTrimmed, passwordTrimmed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          if (!resp.Login) {
            this.presentToast('Correo o contraseña incorrectos', 'danger');
            this.loading = false;
            return;
          }

          // 🔥 LIMPIAR SESIÓN ANTERIOR
          localStorage.removeItem(AUTH_STORAGE.USER);
          localStorage.removeItem(AUTH_STORAGE.ROLE);
          localStorage.removeItem(AUTH_STORAGE.IS_GOOGLE);

          // Guardar únicamente metadata de UI (sin tokens)
          localStorage.setItem(AUTH_STORAGE.ROLE, resp.User_data.usr_rol);
          localStorage.setItem(AUTH_STORAGE.IS_GOOGLE, 'false'); // 👈 LOGIN NORMAL

          // Obtener perfil completo para is_master
          this.authService
            .getUserById(resp.User_data.usr_uuid)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (userFullData) => {
                const userDataFromApi = userFullData?.data || userFullData;
                const isMaster = Boolean(
                  userDataFromApi?.is_master ??
                  userDataFromApi?.isMaster ??
                  userDataFromApi?.master ??
                  false,
                );

                const userData = { ...resp.User_data, is_master: isMaster };

                localStorage.setItem(
                  AUTH_STORAGE.USER,
                  JSON.stringify(userData),
                );

                this.redirectByRole(userData.usr_rol);
                this.loading = false;
              },
              error: (err) => {
                console.warn(
                  'No se pudo obtener perfil completo, usando datos parciales',
                  err,
                );

                localStorage.setItem(
                  AUTH_STORAGE.USER,
                  JSON.stringify(resp.User_data),
                );

                this.redirectByRole(resp.User_data.usr_rol);
                this.loading = false;
              },
            });
        },
        error: (err) => {
          this.loading = false;

          let errorMessage =
            err.error?.message ?? 'Correo o contraseña incorrectos';

          if (err.status === 403) {
            errorMessage = 'Tu cuenta aún no ha sido aprobada';
          } else if (err.status === 400) {
            errorMessage = 'Datos de entrada inválidos';
          }

          this.presentToast(errorMessage, 'danger');
        },
      });
  }

  /* ======================
     GOOGLE INIT
  ====================== */
  ngAfterViewInit() {
    void this.initGoogleButton();

    // Detectar si viene con parámetro para abrir modal de registro
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (params['openRegister'] === 'true') {
          // Esperar a que el componente esté completamente rendido
          setTimeout(() => {
            this.goToRegister();
          }, 500);
        }
      });
  }

  private async initGoogleButton(): Promise<void> {
    if (this.googleButtonReady || this.googleInitInProgress) {
      return;
    }

    this.googleInitInProgress = true;
    this.googleButtonError = false;

    const maxAttempts = 20;
    const delayMs = 250;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const googleApi = (window as any).google;

        if (googleApi?.accounts?.id) {
          try {
            googleApi.accounts.id.initialize({
              client_id: environment.google.clientId,
              callback: (response: any) => this.handleGoogleLogin(response),
            });

            const googleBtn = document.getElementById('googleBtn');

            if (!googleBtn) {
              console.warn('[Google Login] Botón googleBtn no encontrado');
              this.googleButtonError = true;
              return;
            }

            googleBtn.innerHTML = '';

            googleApi.accounts.id.renderButton(googleBtn, {
              theme: 'outline',
              size: 'large',
              shape: 'pill',
              width: 300,
            });

            this.googleButtonReady = true;
            return;
          } catch (error) {
            console.error('[Google Login] Error inicializando botón:', error);
            this.googleButtonError = true;
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      this.googleButtonError = true;
      console.warn('[Google Login] SDK de Google no disponible');
    } finally {
      this.googleInitInProgress = false;
    }
  }

  retryGoogleButton() {
    this.googleButtonReady = false;
    void this.initGoogleButton();
  }

  async handleGoogleNativeClick(): Promise<void> {
    this.loading = true;

    try {
      if (!this.googleButtonReady) {
        await this.initGoogleButton();
      }

      const googleApi = (window as any).google;

      // Fallback: si el SDK de Google no está presente en este WebView,
      // abrimos la página de login web en una nueva ventana/pestaña.
      if (!googleApi) {
        const webBase = (environment as any).webUrl
          ? (environment as any).webUrl
          : environment.apiUrl.replace('/api', '');
        const webLogin = webBase + '/auth/login';
        try {
          window.open(webLogin, '_blank');
        } catch (err) {
          window.location.href = webLogin;
        }
        this.presentToast('Abriendo login web para Google...', 'info');
        this.loading = false;
        return;
      }

      if (!googleApi?.accounts?.id?.prompt) {
        this.presentToast('Google no está disponible en la app.', 'warning');
        this.loading = false;
        return;
      }

      googleApi.accounts.id.prompt();
    } catch (error) {
      console.error('[Google Login] Error en app nativa:', error);
      this.presentToast('No se pudo abrir Google en la app.', 'danger');
      this.loading = false;
    }
  }

  /* ======================
     GOOGLE LOGIN
  ====================== */
  handleGoogleLogin(response: any) {
    const idToken = response?.credential;

    if (!idToken) {
      this.presentToast('No se pudo obtener el token de Google', 'danger');
      return;
    }

    this.loading = true;

    this.authService
      .loginWithGoogle(idToken)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.loading = false;

          if (res.Login && res.User_data?.usr_rol) {
            localStorage.setItem(AUTH_STORAGE.IS_GOOGLE, 'true');
            this.redirectByRole(res.User_data.usr_rol);
          }
        },
        error: async (err) => {
          this.loading = false;

          const errorCode = err?.error?.code;
          const pendingUserId = err?.error?.user?.id;
          const pendingUserName = err?.error?.user?.full_name || '';

          if (err.status === 403 && errorCode === 'ACCOUNT_SUSPENDED') {
            this.presentToast('Tu cuenta está suspendida', 'danger');
            return;
          }

          if (err.status === 403 && pendingUserId) {
            await this.openGooglePendingRegister(
              pendingUserId,
              pendingUserName,
            );
            return;
          }

          if (err.status === 403) {
            this.presentToast(
              'No se pudo abrir el formulario de registro',
              'warning',
            );
            return;
          }

          this.presentToast(
            err?.error?.message || 'Error al iniciar sesión con Google',
            'danger',
          );
        },
      });
  }

  private async openGooglePendingRegister(userId: string, fullName = '') {
    const modal = await this.modalCtrl.create({
      component: RegisterModalComponent,
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
      componentProps: {
        initialStep: 2,
        createdUserId: userId,
        initialFullName: fullName,
      },
    });

    await modal.present();
  }

  /* ======================
     UI
  ====================== */
  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: APP_TOAST.DURATION,
      color,
      position: APP_TOAST.POSITION,
    });
    await toast.present();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  goToRecover() {
    this.router.navigate(['/auth/account_recovery']);
  }

  async goToRegister() {
    const modal = await this.modalCtrl.create({
      component: RegisterModalComponent,
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
    });
    await modal.present();
  }

  goToPrivacyPolicy() {
    this.navigationService.setPreviousUrl('/auth/login');
    this.router.navigate(['/privacy-policy']);
  }

  goToTermsConditions() {
    this.navigationService.setPreviousUrl('/auth/login');
    this.router.navigate(['/terms-conditions']);
  }
}
