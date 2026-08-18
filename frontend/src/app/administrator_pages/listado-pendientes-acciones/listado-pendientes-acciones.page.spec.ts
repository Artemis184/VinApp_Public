import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListadoPendientesAccionesPage } from './listado-pendientes-acciones.page';

describe('ListadoPendientesAccionesPage', () => {
  let component: ListadoPendientesAccionesPage;
  let fixture: ComponentFixture<ListadoPendientesAccionesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ListadoPendientesAccionesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
