import {
  provideZoneChangeDetection,
  importProvidersFrom,
  APP_INITIALIZER,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import {
  provideHttpClient,
  HTTP_INTERCEPTORS,
  withInterceptorsFromDi,
} from '@angular/common/http';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { SessionService } from './app/services/session.service';

import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';
import { IonicStorageModule } from '@ionic/storage-angular';

// Manejo automático de sesiones
import { AuthInterceptor } from './app/auth/interceptors/auth.interceptor';

// Iconos
import { addIcons } from 'ionicons';
import {
  personCircle,
  personCircleOutline,
  menuOutline,
  checkmarkCircle,
  chevronDownCircleOutline,
  chevronForwardOutline,
  pencilOutline,
  checkboxOutline,
  closeCircle,
  closeCircleOutline,
  close,
  closeOutline,
  arrowDown,
  arrowBackOutline,
  repeat,
  shieldCheckmark,
  shieldCheckmarkOutline,
  documentText,
  documentTextOutline,
  informationCircle,
  mail,
  person,
  personOutline,
  image,
  key,
  settings,
  lockClosed,
  lockClosedOutline,
  server,
  logoGoogle,
  handRight,
  eye,
  eyeOutline,
  eyeOffOutline,
  create,
  createOutline,
  trash,
  trashOutline,
  saveOutline,
  refresh,
  calendarOutline,
  listOutline,
  funnel,
  funnelOutline,
  searchOutline,
  apps,
  personAdd,
  logIn,
  checkmarkDone,
  thumbsUp,
  ban,
  warning,
  removeCircle,
  cloud,
  cameraOutline,
} from 'ionicons/icons';

// REGISTRA ICONOS
addIcons({
  'person-circle': personCircle,
  'menu-outline': menuOutline,
  'checkmark-circle': checkmarkCircle,
  'chevron-down-circle-outline': chevronDownCircleOutline,
  'chevron-forward-outline': chevronForwardOutline,
  'person-circle-outline': personCircleOutline,
  'pencil-outline': pencilOutline,
  'checkbox-outline': checkboxOutline,
  'close-circle': closeCircle,
  'close-circle-outline': closeCircleOutline,
  close: close,
  'close-outline': closeOutline,
  'arrow-down': arrowDown,
  'arrow-back-outline': arrowBackOutline,
  'shield-checkmark': shieldCheckmark,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'information-circle': informationCircle,
  mail: mail,
  person: person,
  'person-outline': personOutline,
  image: image,
  key: key,
  repeat: repeat,
  'document-text': documentText,
  'document-text-outline': documentTextOutline,
  settings: settings,
  'lock-closed': lockClosed,
  'lock-closed-outline': lockClosedOutline,
  server: server,
  'logo-google': logoGoogle,
  'hand-right': handRight,
  eye: eye,
  'eye-outline': eyeOutline,
  'eye-off-outline': eyeOffOutline,
  create: create,
  'create-outline': createOutline,
  trash: trash,
  'trash-outline': trashOutline,
  'save-outline': saveOutline,
  refresh: refresh,
  'calendar-outline': calendarOutline,
  'list-outline': listOutline,
  funnel: funnel,
  'funnel-outline': funnelOutline,
  'search-outline': searchOutline,
  apps: apps,
  'person-add': personAdd,
  'log-in': logIn,
  'checkmark-done': checkmarkDone,
  'thumbs-up': thumbsUp,
  ban: ban,
  warning: warning,
  'remove-circle': removeCircle,
  cloud: cloud,
  'camera-outline': cameraOutline,
});

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    importProvidersFrom(IonicStorageModule.forRoot()),
    // Inicializar sesión antes de la navegación para evitar redirecciones prematuras
    {
      provide: APP_INITIALIZER,
      useFactory: (session: SessionService) => {
        return () => session.restoreSession();
      },
      deps: [SessionService],
      multi: true,
    },
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Configurar HTTP con interceptor de autenticación
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
});
