import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatosUsuarioFPage } from './datos-usuario-f.page';

describe('DatosUsuarioFPage', () => {
  let component: DatosUsuarioFPage;
  let fixture: ComponentFixture<DatosUsuarioFPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DatosUsuarioFPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
