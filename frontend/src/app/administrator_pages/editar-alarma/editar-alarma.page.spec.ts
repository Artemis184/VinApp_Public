import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditarAlarmaPage } from './editar-alarma.page';

describe('EditarAlarmaPage', () => {
  let component: EditarAlarmaPage;
  let fixture: ComponentFixture<EditarAlarmaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EditarAlarmaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
