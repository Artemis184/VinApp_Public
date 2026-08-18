import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  IonContent,
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonToolbar,
  IonHeader,
  IonTitle,
  IonCol,
  IonRow,
  IonGrid,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  lockClosedOutline,
  shieldCheckmarkOutline,
  notificationsOutline,
  documentLockOutline,
} from 'ionicons/icons';
import { NavigationService } from '../services/navigation.service';
import { SessionService } from '../services/session.service';
import { APP_ROLES } from 'src/constants/app.constants';

addIcons({
  lockClosedOutline,
  shieldCheckmarkOutline,
  notificationsOutline,
  documentLockOutline,
});

@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonButton,
    IonCard,
    IonCardContent,
    IonIcon,
    IonToolbar,
    IonHeader,
    IonTitle,
    IonCol,
    IonRow,
    IonGrid,
  ],
})
export class LandingPage {
  private readonly nativeLandingSeenKey = 'VINAPP_NATIVE_LANDING_SEEN';
  private router = inject(Router);
  private navigationService = inject(NavigationService);
  private sessionService = inject(SessionService);

  async ngOnInit() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const restoredSession = await this.sessionService.restoreSession();

    if (restoredSession?.role) {
      this.redirectByRole(restoredSession.role);
      return;
    }

    const seenLanding = localStorage.getItem(this.nativeLandingSeenKey) === 'true';

    if (seenLanding) {
      this.router.navigate(['/auth/login'], { replaceUrl: true });
      return;
    }

    localStorage.setItem(this.nativeLandingSeenKey, 'true');
  }

  private redirectByRole(role: string) {
    const normalizedRole = role.toUpperCase();

    if (normalizedRole === APP_ROLES.ADMIN || normalizedRole === APP_ROLES.MASTER) {
      this.router.navigate(['/administrator/principal-administrador'], {
        replaceUrl: true,
      });
      return;
    }

    this.router.navigate(['/final-user/principal-usuariof'], {
      replaceUrl: true,
    });
  }

  goToLogin() {
    this.navigationService.setPreviousUrl('/');
    this.router.navigate(['/auth/login']);
  }

  goToRegister() {
    this.navigationService.setPreviousUrl('/');
    this.router.navigate(['/auth/login'], {
      queryParams: { openRegister: true },
    });
  }

  goToPrivacyPolicy() {
    this.navigationService.setPreviousUrl('/');
    this.router.navigate(['/privacy-policy']);
  }

  goToTermsConditions() {
    this.navigationService.setPreviousUrl('/');
    this.router.navigate(['/terms-conditions']);
  }
}
