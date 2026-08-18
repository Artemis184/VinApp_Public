import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminUsuariosPage } from './admin-usuarios.page';

describe('AdminUsuariosPage', () => {
  let component: AdminUsuariosPage;
  let fixture: ComponentFixture<AdminUsuariosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminUsuariosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
