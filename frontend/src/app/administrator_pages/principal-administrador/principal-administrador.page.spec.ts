import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrincipalAdministradorPage } from './principal-administrador.page';

describe('PrincipalAdministradorPage', () => {
  let component: PrincipalAdministradorPage;
  let fixture: ComponentFixture<PrincipalAdministradorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PrincipalAdministradorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
