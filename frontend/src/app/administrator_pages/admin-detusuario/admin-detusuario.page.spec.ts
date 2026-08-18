import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminDetusuarioPage } from './admin-detusuario.page';

describe('AdminDetusuarioPage', () => {
  let component: AdminDetusuarioPage;
  let fixture: ComponentFixture<AdminDetusuarioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminDetusuarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
