import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListadoUsuPage } from './listado-usu.page';

describe('ListadoUsuPage', () => {
  let component: ListadoUsuPage;
  let fixture: ComponentFixture<ListadoUsuPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ListadoUsuPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
