import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { AdminSideMenuComponentComponent } from './admin-side-menu-component';

describe('AdminSideMenuComponentComponent', () => {
  let component: AdminSideMenuComponentComponent;
  let fixture: ComponentFixture<AdminSideMenuComponentComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AdminSideMenuComponentComponent],
      imports: [IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSideMenuComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
