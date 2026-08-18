import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaAuditoriaAdminsPage } from './lista-auditoria-admins.page';

describe('ListaAuditoriaAdminsPage', () => {
  let component: ListaAuditoriaAdminsPage;
  let fixture: ComponentFixture<ListaAuditoriaAdminsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ListaAuditoriaAdminsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
