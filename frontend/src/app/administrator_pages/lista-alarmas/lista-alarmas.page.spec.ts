import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaAlarmasPage } from './lista-alarmas.page';

describe('ListaAlarmasPage', () => {
  let component: ListaAlarmasPage;
  let fixture: ComponentFixture<ListaAlarmasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ListaAlarmasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
