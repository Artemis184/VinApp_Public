import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminAlarmasModalPage } from './admin-alarmas-modal.page';

describe('AdminAlarmasModalPage', () => {
  let component: AdminAlarmasModalPage;
  let fixture: ComponentFixture<AdminAlarmasModalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminAlarmasModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
