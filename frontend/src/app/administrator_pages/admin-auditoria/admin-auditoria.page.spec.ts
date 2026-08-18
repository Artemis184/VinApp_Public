import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminAuditoriaPage } from './admin-auditoria.page';

describe('AdminAuditoriaPage', () => {
  let component: AdminAuditoriaPage;
  let fixture: ComponentFixture<AdminAuditoriaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminAuditoriaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
