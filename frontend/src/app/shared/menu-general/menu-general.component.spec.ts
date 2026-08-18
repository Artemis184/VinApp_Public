import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import {
  AlertController,
  ModalController,
  ToastController,
} from '@ionic/angular';

import { MenuGeneralComponent } from './menu-general.component';
import { MenuGeneralProfileService } from './services/menu-general-profile.service';
import { AuthService } from 'src/app/auth/services/auth.service';
import { MENU_GENERAL_CONFIG } from 'src/constants/app.constants';

describe('MenuGeneralComponent', () => {
  let component: MenuGeneralComponent;
  let fixture: ComponentFixture<MenuGeneralComponent>;
  let profileServiceSpy: jasmine.SpyObj<MenuGeneralProfileService>;

  const myProfileResponseMock = {
    data: {
      id: 'user-id',
      email: 'user@test.com',
      full_name: 'Test User',
      apodo: 'Tester',
      phone: '5551234',
      address: 'Street 123',
      reference: 'Near park',
      profile_photo: null,
      avatar_base64: null,
      avatar_mime_type: null,
    },
    message: 'ok',
  };

  beforeEach(async () => {
    profileServiceSpy = jasmine.createSpyObj<MenuGeneralProfileService>(
      'MenuGeneralProfileService',
      ['getMyProfile', 'updateMyProfile'],
    );
    profileServiceSpy.getMyProfile.and.returnValue(of(myProfileResponseMock));

    await TestBed.configureTestingModule({
      imports: [MenuGeneralComponent],
      providers: [
        {
          provide: MenuGeneralProfileService,
          useValue: profileServiceSpy,
        },
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj<AuthService>('AuthService', [
            'logout',
          ]),
        },
        {
          provide: Router,
          useValue: jasmine.createSpyObj<Router>('Router', ['navigate']),
        },
        {
          provide: ToastController,
          useValue: {
            create: jasmine
              .createSpy('create')
              .and.resolveTo({ present: jasmine.createSpy('present') }),
          },
        },
        {
          provide: AlertController,
          useValue: {
            create: jasmine
              .createSpy('create')
              .and.resolveTo({ present: jasmine.createSpy('present') }),
          },
        },
        {
          provide: ModalController,
          useValue: {
            dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuGeneralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load profile data on init', () => {
    expect(profileServiceSpy.getMyProfile).toHaveBeenCalled();
    expect(component.formulario.full_name).toBe('Test User');
    expect(component.formulario.apodo).toBe('Tester');
    expect(component.avatarPreview).toBe(
      MENU_GENERAL_CONFIG.DEFAULT_AVATAR_PATH,
    );
  });
});
